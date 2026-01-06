import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createControls({ camera, renderer, onStart }) {
  const controls = new OrbitControls(camera, renderer.domElement);
  if (onStart) controls.addEventListener("start", onStart);

  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  controls.enableZoom = true;
  controls.enablePan = true;
  controls.enableRotate = true;

  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN,
  };

  controls.zoomSpeed = 0.85;
  controls.rotateSpeed = 0.85;
  controls.panSpeed = 0.8;
  controls.screenSpacePanning = true;

  renderer.domElement.addEventListener('touchmove', (e) => {
    e.preventDefault();
  }, { passive: false });

  return controls;
}
