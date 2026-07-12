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
  // Transparent canvas: let the page CSS gradient show through as the
  // background, which is already tuned for the design language.
  scene.background = null;

  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // we want flat cel values

  // ---------- Camera ----------
  const camera = new THREE.PerspectiveCamera(
    35, // slightly long lens — flattens the model like a reference sheet
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 1.55, 4.5);

  // ---------- Toon gradient map (2-step cel shading) ----------
  // A 2x1 texture that the toon material samples instead of a continuous
  // lighting term. Produces the hard "shadow side / light side" look from
  // the reference sheet.
  const gradientCanvas = document.createElement('canvas');
  gradientCanvas.width = 2;
  gradientCanvas.height = 1;
  const gctx = gradientCanvas.getContext('2d');
  gctx.fillStyle = '#3a3a48'; // shadow side — cool dark grey
  gctx.fillRect(0, 0, 1, 1);
  gctx.fillStyle = '#e8e8ee'; // light side — near-white
  gctx.fillRect(1, 0, 1, 1);
  const gradientMap = new THREE.CanvasTexture(gradientCanvas);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.colorSpace = THREE.SRGBColorSpace;

  // ---------- Lighting ----------
  // Key light: warm-neutral, comes from front-upper-right (matches the
  // reference sheet, where the light side faces the viewer).
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 1.6);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);

  // Fill light: cool, weak, opposite side. Lifts the shadow side just enough
  // to read the silhouette without softening the cel edge.
  const fillLight = new THREE.DirectionalLight(0x8aa0c8, 0.45);
  fillLight.position.set(-4, 2, -2);
  scene.add(fillLight);

  // Tiny ambient floor so the underside doesn't go pure black on a white GLB.
  const ambient = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambient);

  // ---------- Ground ----------
  // A flat disc with a faint edge — gives the model something to stand on
  // and catches a subtle shadow without dominating the frame.
  const groundGeo = new THREE.CircleGeometry(6, 64);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x232330,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  // Soft contact shadow under the model (a darker disc, slightly above ground)
  const shadowGeo = new THREE.CircleGeometry(0.9, 48);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.001; // avoid z-fighting with ground
  scene.add(contactShadow);

  // ---------- Controls ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1.0, 0);
  controls.minDistance = 2.2;
  controls.maxDistance = 8;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.55; // can't look up at the floor
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

  // Build a fresh toon material so we can override the GLB's defaults
  // (which are typically just white). We preserve textures if the mesh had any.
  function makeToonMaterial(source) {
    const mat = new THREE.MeshToonMaterial({
      color: 0xe8e8ee, // base near-white (the "light side" of the cel map)
      gradientMap,
      transparent: !!source?.transparent,
      side: source?.side ?? THREE.FrontSide,
    });
    // Keep any map the modeler already painted on the mesh (e.g. clothing
    // color baked in Blender) — multiplied with the toon base color.
    if (source?.map) mat.map = source.map;
    return mat;
  }

  // ---------- Load model ----------
  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;

      // 1. Force every mesh onto a toon material, recolor eyes to the
      //    single warm accent. This is the part the user said to optimize
      //    in Blender later — for now we override so the white model reads
      //    as a designed character.
      model.traverse((child) => {
        if (!child.isMesh) return;

        const name = (child.name || '').toLowerCase();
        const isEye = EYE_MESH_NAMES.has(name) || name.includes('eye');

        child.castShadow = false;
        child.receiveShadow = false;
        child.material = isEye
          ? new THREE.MeshBasicMaterial({ color: 0xc24545 })
          : makeToonMaterial(child.material);
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
      const headY = scaledBox.max.y * 0.92;
      controls.target.set(0, headY, 0);
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
    camera.aspect = width / height;
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
