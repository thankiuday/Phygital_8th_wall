/**
 * WebXR helpers for surface AR sessions.
 */

export const checkWebXrArSupported = async () => {
  if (!navigator.xr?.isSessionSupported) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
};

/**
 * @param {HTMLElement | null | undefined} domOverlayRoot
 */
export const buildSurfaceSessionInit = (domOverlayRoot) => {
  const init = {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['local-floor'],
  };

  if (domOverlayRoot) {
    init.optionalFeatures.push('dom-overlay');
    init.domOverlay = { root: domOverlayRoot };
  }

  return init;
};

/**
 * Request immersive-ar session (must be called inside a user gesture).
 * @param {HTMLElement | null | undefined} domOverlayRoot
 */
export const requestSurfaceSession = (domOverlayRoot) =>
  navigator.xr.requestSession('immersive-ar', buildSurfaceSessionInit(domOverlayRoot));
