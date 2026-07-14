import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Initialize a Three.js scene that loads and displays a GLB model.
 *
 * Visual goals (from the character sheet reference):
 *  - Cool, desaturated grey base; only the eyes are warm (red accent).
 *  - Toon / cel-shaded look: hard two-step lighting, no soft gradients.
 *  - "Standing at a desk" feel: model on a clean ground, camera at eye level,
 *    damped orbit so the model reads as a still subject, not a turntable.
 *  - Subtle vignette via the page background; the 3D canvas itself is clean.
 *
 * @param {string} canvasId - The id of the canvas element to render into.
 * @param {string} modelUrl - The URL of the GLB model to load.
 */
export function initModelViewer(canvasId, modelUrl) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Canvas with id "${canvasId}" not found.`);
    return;
  }

  // ---------- Scene ----------
  const scene = new THREE.Scene();
  // Flat near-white — the reference sheet's background is a single light
  // tone with no gradient and no visible horizon. The dark grey of the
  // page outside the canvas takes care of the "framing" feel.
  scene.background = new THREE.Color(0xf2f2f4);

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // we want flat cel values

  // ---------- Camera ----------
  // Orthographic projection — this is the "三渲二" (cel-shaded 2D) look
  // from the reference sheet: no foreshortening, no vanishing point, the
  // figure's head/torso/leg proportions stay exactly the same as the
  // camera orbits. The viewport is sized in world units (not pixels) so
  // the model always frames the same way regardless of canvas size.
  const VIEW_HEIGHT = 2.6; // world units visible vertically
  let viewWidth = VIEW_HEIGHT * (canvas.clientWidth / canvas.clientHeight);
  const camera = new THREE.OrthographicCamera(
    -viewWidth / 2,
    viewWidth / 2,
    VIEW_HEIGHT / 2,
    -VIEW_HEIGHT / 2,
    -100,
    100
  );
  camera.position.set(0, 1.45, 10);
  camera.lookAt(0, 1.45, 0);

  // ---------- Toon gradient maps ----------
  // A "toon gradient" is a 1D texture that maps a surface's lighting
  // intensity (the dot product of normal × light) to an output color.
  // Three.js samples it with nearest-neighbor filtering, so we get hard
  // "cel" bands rather than smooth gradients.
  //
  // Different parts of the model want different contrast levels:
  //  - Light clothing: very subtle 3-step ramp, almost imperceptible
  //    bands so the figure reads as a light silhouette.
  //  - Dark clothing (e.g. the dress): a steeper ramp so the same
  //    normal variation between pleats produces *visible* bands.
  function makeGradient(stops) {
    const c = document.createElement('canvas');
    c.width = stops.length;
    c.height = 1;
    const ctx = c.getContext('2d');
    stops.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect(i, 0, 1, 1);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // Light gradient: for everything that should read as "near-white".
  // Stops span only the upper end of the range so the cel band is
  // barely visible (matches the reference's clean white surfaces).
  const lightGradient = makeGradient(['#b4b4bc', '#e6e6ec', '#ffffff']);

  // Dress gradient: most of a near-front-facing dress falls in the
  // middle stop, so we set the *brightest* stop to a mid-grey (the
  // reference's "main" dress color) and let the pleats' side-facing
  // faces drop to a darker stop. This is what produces a visible
  // cel band on the pleats without washing the whole dress out.
  const dressGradient = makeGradient(['#0e0e14', '#3a3a44', '#7a7a82']);

  // ---------- Lighting ----------
  // On a near-white background we want strong key + weak fill so the
  // light side of the model reaches the gradient's brightest stop (true
  // white) and only the shadow side goes grey. Less ambient overall.
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(0, 6, 5);
  scene.add(keyLight);

  // Fill: weak, behind the camera — lifts the shadow side without
  // flattening the cel boundary.
  const fillLight = new THREE.DirectionalLight(0xe6ecf2, 0.3);
  fillLight.position.set(0, 4, -2);
  scene.add(fillLight);

  // Hemisphere: small sky/ground color split. Lifts the underside of
  // the figure just a touch warmer than the shadow stop, so it doesn't
  // crush to a flat grey.
  const hemi = new THREE.HemisphereLight(0xfafafc, 0x9a9aa6, 0.35);
  scene.add(hemi);

  // Tiny ambient so we never go pure black — but small enough to keep
  // the dark side of the model reading as a clear cel band.
  const ambient = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambient);

  // ---------- Room (procedural) ----------
  // With a flat near-white scene.background, no backdrop plane is needed —
  // the entire canvas reads as the same light tone. The "ground" is
  // implied only by the soft contact shadow under the model's feet, which
  // is the same trick the reference sheet uses.
  //
  // (Backdrop plane removed — `scene.background` does the job.)

  // Soft contact shadow under the model — a faded, semi-transparent disc
  // (not a hard black one). Built from a radial gradient texture so the
  // edge dissolves instead of cutting.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  {
    const c = shadowCanvas.getContext('2d');
    const grad = c.createRadialGradient(128, 128, 8, 128, 128, 124);
    grad.addColorStop(0, 'rgba(0,0,0,0.14)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = grad;
    c.fillRect(0, 0, 256, 256);
  }
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.002;
  scene.add(contactShadow);

  // ---------- Controls ----------
  // For an orthographic camera OrbitControls uses `zoom` (multiply
  // projection) rather than physical distance. We expose the same
  // "scroll = zoom" feel by clamping the zoom range.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.45, 0);
  controls.minZoom = 0.6;
  controls.maxZoom = 2.5;
  controls.minPolarAngle = Math.PI * 0.2;
  controls.maxPolarAngle = Math.PI * 0.5; // can't look up at the floor
  controls.enablePan = false; // keeps the character centered like a stat sheet
  controls.update();

  // ---------- Material helpers ----------
  // Names we treat as "the eyes" — the warm accent. Add more names here as
  // the Blender model grows and gains proper eye meshes.
  const EYE_MESH_NAMES = new Set([
    'eye',
    'eyes',
    'eye_l',
    'eye_r',
    'eye_left',
    'eye_right',
    'pupil',
    'pupils',
  ]);

  // Build a fresh toon material, preserving whatever the GLB carried in.
  // The GLB's `color` (set in Blender via material slots / vertex paint)
  // is what gives each part of the model its own tone — we must keep it.
  // Pass an explicit `gradient` to override the default (light) gradient,
  // e.g. for the dress, which needs a steeper contrast ramp.
  function makeToonMaterial(source, { gradient = lightGradient } = {}) {
    const mat = new THREE.MeshToonMaterial({
      // Start from the GLB's base color if present, otherwise pure white.
      // (Multiplying pure white with the gradient gives the gradient; for
      // a part that already has a base color, multiplying it with the
      // gradient gives the cel-shaded version of that color.)
      color: source?.color?.clone() ?? 0xffffff,
      gradientMap: gradient,
      transparent: !!source?.transparent,
      side: source?.side ?? THREE.FrontSide,
    });
    // Keep any texture the modeler already painted on the mesh (e.g. a
    // Texture Paint pass in Blender) — multiplies on top of base color.
    if (source?.map) mat.map = source.map;
    // Keep vertex colors too, if the GLB has them.
    if (source?.vertexColors) mat.vertexColors = true;
    return mat;
  }

  // Mesh names that should use the dark (high-contrast) gradient. This
  // list is intentionally short: we only override parts that already
  // have a dark base color in the reference sheet, so the override is
  // purely about making the cel band readable.
  const DARK_MESH_NAMES = new Set(['dress', 'collar', 'skirt', 'shoes']);

  // ---------- Load model ----------
  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;

      // 1. Build a toon material per mesh. Three material flavors:
      //    - Eye meshes: solid red MeshBasicMaterial (no cel band).
      //    - Dark meshes (dress, collar, etc.): high-contrast gradient
      //      so normal variation between pleats shows as visible bands.
      //    - Everything else: light gradient for a near-white cel look.
      //
      //    Base color is taken from the GLB (Blender material slot),
      //    but the dress is overridden to a fixed reference tone — this
      //    way the color decision lives in the web frontend, not the GLB.
      const DRESS_BASE = 0xffffff; // white × dark gradient = dark stops
      model.traverse((child) => {
        if (!child.isMesh) return;

        const name = (child.name || '').toLowerCase();
        const isEye = EYE_MESH_NAMES.has(name) || name.includes('eye');
        const isDress = name === 'dress';

        child.castShadow = false;
        child.receiveShadow = false;

        if (isEye) {
          child.material = new THREE.MeshBasicMaterial({ color: 0xc24545 });
        } else {
          // For the dress: ignore the GLB's base color (white in the
          // source file), and let the dark gradient define the look.
          // For everything else: inherit whatever the GLB has.
          const source = isDress
            ? { ...child.material, color: new THREE.Color(DRESS_BASE) }
            : child.material;
          const gradient = isDress ? dressGradient : lightGradient;
          child.material = makeToonMaterial(source, { gradient });
        }
      });

      // 2. Fit the model to the camera: normalize height to ~1.7 units
      //    (loosely matching the 172cm in the reference), then re-center.
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const targetHeight = 1.7;
      const scale = targetHeight / size.y;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      const center = scaledBox.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      model.position.y -= scaledBox.min.y; // feet on the ground

      // 3. Place the contact shadow under the model's feet.
      contactShadow.position.x = model.position.x;
      contactShadow.position.z = model.position.z;

      // 4. Aim the camera at chest/face height of the fitted model.
      const targetY = scaledBox.max.y * 0.85;
      controls.target.set(0, targetY, 0);
      camera.lookAt(0, targetY, 0);
      controls.update();

      scene.add(model);
    },
    (xhr) => {
      if (xhr.total > 0) {
        const percent = (xhr.loaded / xhr.total) * 100;
        console.log(`Model ${percent.toFixed(1)}% loaded`);
      }
    },
    (error) => {
      console.error('Error loading GLB model:', error);
    }
  );

  // ---------- Resize ----------
  function onResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    // Orthographic frustum: keep viewport height constant in world units,
    // recompute width from aspect. This guarantees the model always fills
    // the same proportion of the canvas.
    viewWidth = VIEW_HEIGHT * (width / height);
    camera.left = -viewWidth / 2;
    camera.right = viewWidth / 2;
    camera.top = VIEW_HEIGHT / 2;
    camera.bottom = -VIEW_HEIGHT / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  window.addEventListener('resize', onResize);
  // Also observe the canvas directly in case layout changes without a window
  // resize (e.g. dev tools opening).
  const ro = new ResizeObserver(onResize);
  ro.observe(canvas);

  // ---------- Render loop ----------
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}
