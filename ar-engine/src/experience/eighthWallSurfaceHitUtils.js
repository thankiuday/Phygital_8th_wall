/**
 * 8th Wall SLAM surface-hit helpers — iOS only (eighthWallSurfaceSession).
 */

import { applyMatrixToGroup, resetGroupTransform } from './surfaceHitUtils.js';

export { applyMatrixToGroup, resetGroupTransform };

export const MIN_HORIZONTAL_SCORE = 0.2;
export const SURFACE_LIFT_M = 0.04;

/** Screen samples — floor (lower frame) and table height (mid frame). */
export const SURFACE_HIT_SAMPLE_NORMS = [
  [0.5, 0.45],
  [0.5, 0.55],
  [0.38, 0.5],
  [0.62, 0.5],
  [0.5, 0.62],
  [0.5, 0.72],
  [0.5, 0.82],
  [0.38, 0.75],
  [0.62, 0.75],
];

export const isPlacementUiTarget = (target) => {
  if (!target?.closest) return false;
  return Boolean(target.closest(
    '#ar-hub-toggle, #ar-link-dock, #ar-controls, .surface-ar-close, .ar-ctrl, .ar-link-btn',
  ));
};

const composeHitMatrix = (THREE, position, rotation) => {
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

/** @param {THREE.Group} reticle */
export const applyMatrixToReticle = (reticle, matrix) => {
  reticle.matrixAutoUpdate = false;
  reticle.matrix.copy(matrix);
  reticle.matrix.decompose(reticle.position, reticle.quaternion, reticle.scale);
  reticle.updateMatrixWorld(true);
};

/** Lift placement slightly above the surface so the hologram is not clipped. */
export const liftPlacementMatrix = (THREE, matrix, amount = SURFACE_LIFT_M) => {
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  matrix.decompose(pos, quat, scale);
  pos.y += amount;
  const lifted = new THREE.Matrix4();
  lifted.compose(pos, quat, scale);
  return lifted;
};

const horizontalnessFromMatrix = (m) => Math.abs(m[5]);

const pickBestHorizontalHit = (THREE, results) => {
  if (!results?.length) return null;

  let bestMatrix = null;
  let bestScore = 0;
  let bestDistance = Infinity;

  for (const hit of results) {
    if (!hit?.position) continue;

    let matrix;
    if (hit.rotation) {
      matrix = composeHitMatrix(THREE, hit.position, hit.rotation);
    } else {
      matrix = new THREE.Matrix4();
      matrix.compose(
        new THREE.Vector3(hit.position.x, hit.position.y, hit.position.z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1),
      );
    }

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

/** True when the camera is tilted toward the floor (not a tabletop at waist height). */
const cameraPointsAtGround = (THREE, camera) => {
  if (!camera) return false;
  const forward = getScratchForward(THREE);
  camera.getWorldDirection(forward);
  return forward.y < -0.22;
};

/**
 * Intersect the view ray with 8th Wall's horizontal ground plane (y = 0).
 * Only valid when scanning the floor — not tables/desks above y=0.
 */
const raycastHorizontalGround = (THREE, camera, normX, normY) => {
  if (!THREE || !camera || !cameraPointsAtGround(THREE, camera)) return null;

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

const queryFeatureHitAtNorm = (THREE, hitTestFn, normX, normY) => {
  if (!hitTestFn) return null;
  const results = hitTestFn(normX, normY, ['FEATURE_POINT']);
  const hit = pickBestHorizontalHit(THREE, results);
  return hit ? { ...hit, source: 'feature' } : null;
};

/**
 * Hit-test at a single screen-normalized point (tap / DOM reticle).
 */
export const queryPlacementHitAtScreen = (
  THREE,
  hitTestFn,
  camera,
  normX,
  normY,
  { allowGround = false } = {},
) => {
  const featureHit = queryFeatureHitAtNorm(THREE, hitTestFn, normX, normY);
  if (featureHit) return featureHit;

  if (allowGround) {
    const groundHit = raycastHorizontalGround(THREE, camera, normX, normY);
    if (groundHit) return { ...groundHit, source: 'ground' };
  }

  return null;
};

/**
 * Sample screen points — SLAM feature points first; y=0 ground only when allowed.
 * @returns {{ matrix: THREE.Matrix4, score: number, distance: number, source: 'feature'|'ground' } | null}
 */
export const queryPlacementHit = (
  THREE,
  hitTestFn,
  camera,
  { allowGround = false, norms = SURFACE_HIT_SAMPLE_NORMS } = {},
) => {
  let bestFeature = null;
  let bestGround = null;

  for (const [normX, normY] of norms) {
    const featureHit = queryFeatureHitAtNorm(THREE, hitTestFn, normX, normY);
    if (featureHit && (!bestFeature || featureHit.score > bestFeature.score)) {
      bestFeature = featureHit;
    }

    if (allowGround) {
      const groundHit = raycastHorizontalGround(THREE, camera, normX, normY);
      if (groundHit && (!bestGround || groundHit.score > bestGround.score)) {
        bestGround = { ...groundHit, source: 'ground' };
      }
    }
  }

  return bestFeature || bestGround || null;
};

/** @deprecated Use queryPlacementHit */
export const queryBestSurfaceHit = (THREE, hitTestFn, camera, norms = SURFACE_HIT_SAMPLE_NORMS) =>
  queryPlacementHit(THREE, hitTestFn, camera, { allowGround: true, norms });
