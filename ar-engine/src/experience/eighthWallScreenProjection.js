/**
 * eighthWallScreenProjection — shared 3D→screen math for iOS 8th Wall DOM overlays.
 */

export const getVisualViewport = () => {
  const vv = window.visualViewport;
  return {
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    offsetLeft: vv?.offsetLeft ?? 0,
    offsetTop: vv?.offsetTop ?? 0,
  };
};

export const normToScreen = (normX, normY, vp = getVisualViewport()) => ({
  x: vp.offsetLeft + normX * vp.width,
  y: vp.offsetTop + normY * vp.height,
});

export const getCameraVerticalFovRad = (camera) => {
  if (camera?.fov) return (camera.fov * Math.PI) / 180;
  const e = camera?.projectionMatrix?.elements;
  if (e && e[5]) return 2 * Math.atan(1 / e[5]);
  return (60 * Math.PI) / 180;
};

/**
 * Project a world-space point to screen pixels (after XR8 projection sync).
 * @returns {{ x: number, y: number, ndcZ: number } | null}
 */
export const worldToScreen = (camera, worldPos, projectedOut) => {
  if (!camera || !worldPos) return null;

  camera.updateMatrixWorld?.(true);
  const projected = projectedOut || { x: 0, y: 0, z: 0 };
  if (projected.copy) {
    projected.copy(worldPos).project(camera);
  } else {
    return null;
  }

  if (projected.z > 1.05) return null;

  const vp = getVisualViewport();
  const x = vp.offsetLeft + (projected.x * 0.5 + 0.5) * vp.width;
  const y = vp.offsetTop + (-projected.y * 0.5 + 0.5) * vp.height;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  return { x, y, ndcZ: projected.z };
};

/** Estimate on-screen height in px from world plane height and camera distance. */
export const estimateScreenHeightPx = (planeHeight, camera, worldPos, vp = getVisualViewport()) => {
  if (!camera || !worldPos) return null;
  const dist = camera.position.distanceTo(worldPos);
  if (!Number.isFinite(dist) || dist < 0.08) return null;
  const vFov = getCameraVerticalFovRad(camera);
  return ((planeHeight / dist) / Math.tan(vFov / 2)) * vp.height;
};

/**
 * Project the four corners of a portrait plane mesh to screen bounds.
 * @param {THREE.Mesh | THREE.Group} root — mesh or group whose matrixWorld orients the plane
 * @param {number} planeWidth
 * @param {number} planeHeight
 */
export const projectPlaneScreenBounds = (
  THREE,
  camera,
  root,
  planeWidth,
  planeHeight,
  scratch,
) => {
  if (!THREE || !camera || !root) return null;

  if (!scratch.localBL) {
    const halfW = planeWidth / 2;
    scratch.localBL = new THREE.Vector3(-halfW, 0, 0);
    scratch.localBR = new THREE.Vector3(halfW, 0, 0);
    scratch.localTL = new THREE.Vector3(-halfW, planeHeight, 0);
    scratch.localTR = new THREE.Vector3(halfW, planeHeight, 0);
    scratch.world = new THREE.Vector3();
    scratch.projected = new THREE.Vector3();
  }

  root.updateMatrixWorld?.(true);

  const corners = [
    scratch.localBL,
    scratch.localBR,
    scratch.localTL,
    scratch.localTR,
  ];
  const vp = getVisualViewport();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let valid = 0;

  for (const local of corners) {
    scratch.world.copy(local).applyMatrix4(root.matrixWorld);
    const screen = worldToScreen(camera, scratch.world, scratch.projected);
    if (!screen) continue;

    minX = Math.min(minX, screen.x);
    maxX = Math.max(maxX, screen.x);
    minY = Math.min(minY, screen.y);
    maxY = Math.max(maxY, screen.y);
    valid += 1;
  }

  if (valid < 2) return null;

  const bottomX = (minX + maxX) * 0.5;
  const bottomY = maxY;
  const heightPx = Math.max(16, maxY - minY);
  if (!Number.isFinite(heightPx) || heightPx < 16) return null;

  return { bottomX, bottomY, heightPx };
};
