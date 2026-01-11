import * as THREE from "three";

export function createCameraFitter({ camera, controls, frame }) {
  const fitBox = new THREE.Box3().setFromObject(frame);
  const fitSize = new THREE.Vector3();
  const fitCenter = new THREE.Vector3();
  fitBox.getSize(fitSize);
  fitBox.getCenter(fitCenter);
  fitCenter.set(0, 0, 0);

  function fitCameraToCube() {
    const maxDim = Math.max(fitSize.x, fitSize.y, fitSize.z);
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const aspect = camera.aspect || 1;

    const baseMargin = matchMedia('(pointer: coarse)').matches ? 1.6 : 3;
    const portraitBoost = aspect < 1 ? Math.min(1 / aspect, 2.2) : 1;
    const distance = (maxDim * 0.5) / Math.tan(fov * 0.5) * baseMargin * portraitBoost;

    const dir = new THREE.Vector3(1.2, 0.7, 1.6).normalize();
    camera.position.copy(fitCenter).addScaledVector(dir, distance);
    camera.near = Math.max(0.01, distance / 200);
    camera.far = distance * 200;
    camera.updateProjectionMatrix();

    controls.target.copy(fitCenter);
    controls.update();

    controls.minDistance = distance * 0.20;
    controls.maxDistance = distance * 4.0;
  }

  return { fitCameraToCube };
}

export function setAutoSpin(controls, on) {
  controls.autoRotate = !!on;
  controls.autoRotateSpeed = on ? 3 : 0;
}
