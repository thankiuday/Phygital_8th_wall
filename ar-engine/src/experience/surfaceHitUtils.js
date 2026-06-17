/**
 * Shared surface-hit helpers — WebXR (Android) and 8th Wall SLAM (iOS).
 */

export const POSE_CACHE_MS = 500;
export const MIN_HORIZONTAL_SCORE = 0.35;

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
