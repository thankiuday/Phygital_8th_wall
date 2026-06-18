/**
 * eighthWallVideoSurface — iOS 8th Wall video upload + scene placement helpers.
 *
 * VideoTexture uploads often fail on 8th Wall's WebGL context on iOS Safari.
 * We paint each video frame to a CanvasTexture instead.
 */

/**
 * @param {object} THREE
 * @param {HTMLVideoElement} videoEl
 */
export const createEighthWallCanvasVideoTexture = (THREE, videoEl) => {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext('2d', { alpha: true, willReadFrequently: true });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.encoding = THREE.LinearEncoding;

  const update = () => {
    if (!videoEl || videoEl.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return false;
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    if (!vw || !vh) return false;
    if (canvas.width !== vw || canvas.height !== vh) {
      canvas.width = vw;
      canvas.height = vh;
    }
    ctx.drawImage(videoEl, 0, 0, vw, vh);
    texture.needsUpdate = true;
    return true;
  };

  return { texture, update, canvas };
};

/**
 * Reparent the hologram plane onto the XR scene root while preserving world pose.
 * @param {THREE.Scene} scene
 * @param {THREE.Mesh} plane
 */
export const attachHologramToScene = (scene, plane) => {
  if (!scene || !plane || plane.parent === scene) return;
  scene.attach(plane);
};

/**
 * Billboard the plane toward the camera while keeping it upright (Y-locked).
 * @param {THREE.Mesh} plane
 * @param {THREE.Camera} camera
 */
export const billboardHologramTowardCamera = (plane, camera) => {
  if (!plane || !camera) return;
  plane.getWorldPosition(_worldPos);
  camera.getWorldPosition(_camPos);
  plane.lookAt(_camPos.x, _worldPos.y, _camPos.z);
};

let _worldPos = null;
let _camPos = null;

/** Billboard with scratch vectors (avoids per-frame alloc). */
export const billboardHologramTowardCameraWithScratch = (THREE, plane, camera) => {
  if (!plane || !camera || !THREE) return;
  if (!_worldPos) {
    _worldPos = new THREE.Vector3();
    _camPos = new THREE.Vector3();
  }
  plane.getWorldPosition(_worldPos);
  camera.getWorldPosition(_camPos);
  plane.lookAt(_camPos.x, _worldPos.y, _camPos.z);
};
