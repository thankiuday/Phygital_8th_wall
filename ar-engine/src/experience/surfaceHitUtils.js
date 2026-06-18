/**
 * Shared surface-hit helpers — WebXR (Android) and 8th Wall SLAM (iOS).
 */

export const POSE_CACHE_MS = 500;
export const MIN_HORIZONTAL_SCORE = 0.28;

/** Normalized screen samples — bias toward lower frame where the floor appears. */
export const SURFACE_HIT_SAMPLE_NORMS = [
  [0.5, 0.62],
  [0.5, 0.72],
  [0.5, 0.82],
  [0.38, 0.75],
  [0.62, 0.75],
  [0.5, 0.5],
];

/** How horizontal a hit pose is (1 = flat floor/table). Matches WebXR hit-test scoring. */
export const horizontalnessFromMatrix = (m) => Math.abs(m[5]);

/** Normalized 0–1 hit-test coords for XR8.XrController.hitTest (upper-left origin). */
export const getHitTestNormFromClient = (clientX, clientY) => {
  const vv = window.visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;
  const ox = vv?.offsetLeft ?? 0;
  const oy = vv?.offsetTop ?? 0;
  return {
    x: Math.min(1, Math.max(0, (clientX - ox) / w)),
    y: Math.min(1, Math.max(0, (clientY - oy) / h)),
  };
};

/**
 * @param {object} THREE
 * @param {{ x: number, y: number, z: number }} position
 * @param {{ x: number, y: number, z: number, w: number }} rotation
 */
export const composeHitMatrix = (THREE, position, rotation) => {
  const mat = new THREE.Matrix4();
  const quat = new THREE.Quaternion(
    rotation.x,
    rotation.y,
    rotation.z,
    rotation.w,
  );
  const pos = new THREE.Vector3(position.x, position.y, position.z);
  mat.compose(pos, quat, new THREE.Vector3(1, 1, 1));
  return mat;
};

/** @param {THREE.Group} group */
export const applyMatrixToGroup = (group, matrix) => {
  group.matrixAutoUpdate = false;
  group.matrix.copy(matrix);
  group.matrix.decompose(group.position, group.quaternion, group.scale);
  group.updateMatrixWorld(true);
};

/** @param {THREE.Group} group */
export const resetGroupTransform = (group) => {
  group.matrixAutoUpdate = true;
  group.position.set(0, 0, 0);
  group.quaternion.identity();
  group.scale.set(1, 1, 1);
};

/**
 * Pick the most horizontal hit from XR8 feature-point results.
 * @param {object} THREE
 * @param {Array<{ position: object, rotation: object, distance?: number }>} results
 */
export const pickBestHorizontalHit = (THREE, results) => {
  if (!results?.length) return null;

  let bestMatrix = null;
  let bestScore = 0;
  let bestDistance = Infinity;

  for (const hit of results) {
    if (!hit?.position || !hit?.rotation) continue;
    const matrix = composeHitMatrix(THREE, hit.position, hit.rotation);
    const score = horizontalnessFromMatrix(matrix.elements);
    if (score > bestScore) {
      bestScore = score;
      bestMatrix = matrix;
      bestDistance = hit.distance ?? Infinity;
    }
  }

  if (!bestMatrix || bestScore < MIN_HORIZONTAL_SCORE) return null;
  return { matrix: bestMatrix, score: bestScore, distance: bestDistance };
};

const _scratchVec3a = { v: null };
const _scratchVec3b = { v: null };
const _scratchVec2 = { v: null };
const _scratchRay = { v: null };
const _scratchPlane = { v: null };
const _scratchQuat = { q: null };

const _scratchForward = { v: null };

const getScratchForward = (THREE) => {
  if (!_scratchForward.v) _scratchForward.v = new THREE.Vector3();
  return _scratchForward.v;
};

/**
 * Intersect the view ray with 8th Wall's horizontal ground plane (y = 0).
 * Reliable when FEATURE_POINT hits are sparse (common on uniform floors).
 */
export const raycastHorizontalGround = (THREE, camera, normX, normY) => {
  if (!THREE || !camera) return null;

  camera.updateMatrixWorld(true);

  const ndcX = normX * 2 - 1;
  const ndcY = -(normY * 2 - 1);

  if (!_scratchVec2.v) _scratchVec2.v = new THREE.Vector2();
  if (!_scratchRay.v) _scratchRay.v = new THREE.Raycaster();
  if (!_scratchPlane.v) _scratchPlane.v = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  if (!_scratchVec3a.v) _scratchVec3a.v = new THREE.Vector3();
  if (!_scratchVec3b.v) _scratchVec3b.v = new THREE.Vector3();
  if (!_scratchQuat.q) _scratchQuat.q = new THREE.Quaternion();

  _scratchVec2.v.set(ndcX, ndcY);
  _scratchRay.v.setFromCamera(_scratchVec2.v, camera);

  const hitPoint = _scratchVec3a.v;
  const hit = _scratchRay.v.ray.intersectPlane(_scratchPlane.v, hitPoint);
  if (!hit) return null;

  const camPos = _scratchVec3b.v;
  camera.getWorldPosition(camPos);

  const toHitX = hitPoint.x - camPos.x;
  const toHitY = hitPoint.y - camPos.y;
  const toHitZ = hitPoint.z - camPos.z;

  const forward = getScratchForward(THREE);
  camera.getWorldDirection(forward);
  const dot = toHitX * forward.x + toHitY * forward.y + toHitZ * forward.z;
  if (dot <= 0.05) return null;

  const distance = Math.hypot(toHitX, toHitY, toHitZ);
  const mat = new THREE.Matrix4();
  mat.compose(hitPoint, _scratchQuat.q.identity(), new THREE.Vector3(1, 1, 1));

  return { matrix: mat, score: 1, distance };
};

/**
 * Query one screen point — SLAM feature points first, then y=0 plane raycast.
 */
export const querySurfaceHitAtNorm = (THREE, hitTestFn, camera, normX, normY) => {
  if (!THREE) return null;

  if (hitTestFn) {
    const results = hitTestFn(normX, normY, ['FEATURE_POINT']);
    const fromFeatures = pickBestHorizontalHit(THREE, results);
    if (fromFeatures) return fromFeatures;
  }

  return raycastHorizontalGround(THREE, camera, normX, normY);
};

/**
 * Sample multiple screen points and return the best horizontal hit.
 */
export const queryBestSurfaceHit = (THREE, hitTestFn, camera, norms = SURFACE_HIT_SAMPLE_NORMS) => {
  let best = null;

  for (const [normX, normY] of norms) {
    const hit = querySurfaceHitAtNorm(THREE, hitTestFn, camera, normX, normY);
    if (!hit) continue;
    if (!best || hit.score > best.score) best = hit;
  }

  return best;
};
