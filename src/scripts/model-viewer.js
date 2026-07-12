import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Initialize a Three.js scene that loads and displays a GLB model.
 * @param {string} canvasId - The id of the canvas element to render into.
 * @param {string} modelUrl - The URL of the GLB model to load.
 */
export function initModelViewer(canvasId, modelUrl) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`Canvas with id "${canvasId}" not found.`);
    return;
  }

  // ---- Scene setup ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  // ---- Camera ----
  const camera = new THREE.PerspectiveCamera(
    45,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.5, 4);

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ---- Lights ----
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(5, 10, 7.5);
  scene.add(directionalLight);

  // A fill light from the opposite side
  const fillLight = new THREE.DirectionalLight(0x8899ff, 0.4);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);

  // ---- Controls ----
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 1, 0);
  controls.update();

  // ---- Load GLB model ----
  const loader = new GLTFLoader();
  loader.load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;

      // Center and scale the model to fit nicely in view
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());

      // Normalize size to ~2 units tall
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      model.scale.setScalar(scale);

      // Re-center after scaling
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      model.position.sub(scaledCenter);
      model.position.y += 1; // lift so it sits above the floor

      scene.add(model);

      // Adjust controls target to the model
      controls.target.set(0, 1, 0);
      controls.update();
    },
    (xhr) => {
      const percent = (xhr.loaded / xhr.total) * 100;
      console.log(`Model ${percent.toFixed(1)}% loaded`);
    },
    (error) => {
      console.error('Error loading GLB model:', error);
    }
  );

  // ---- Simple ground grid (optional, helps depth perception) ----
  const gridHelper = new THREE.GridHelper(10, 20, 0x444466, 0x222244);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // ---- Resize handling ----
  function onResize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', onResize);

  // ---- Animation loop ----
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}