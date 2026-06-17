/**
 * eighthWallGestureBoot — start 8th Wall camera synchronously inside a user tap.
 *
 * iOS Safari requires getUserMedia / motion permission inside the gesture that
 * initiated AR. React useEffect boot runs too late, so the landing page calls
 * beginEighthWallSurfaceGesture() directly from the Launch button handler.
 */

import { EighthWallSurfaceSession } from './eighthWallSurfaceSession.js';
import { isEighthWallEngineReady } from './loadEighthWallEngine.js';

let gestureSession = null;

/**
 * @param {HTMLElement} container  #ar-root inside the surface shell
 * @returns {EighthWallSurfaceSession}
 */
export const beginEighthWallSurfaceGesture = (container) => {
  if (!window.THREE) {
    throw new Error('Three.js is still loading. Wait a moment and try again.');
  }
  if (!isEighthWallEngineReady()) {
    throw new Error('AR engine is still loading. Wait a moment and try again.');
  }
  if (!container) {
    throw new Error('AR container not found.');
  }

  const session = new EighthWallSurfaceSession({ container });
  session.beginCameraInUserGesture();
  gestureSession = session;
  return session;
};

/** @returns {EighthWallSurfaceSession | null} */
export const takeGestureEighthWallSession = () => {
  const session = gestureSession;
  gestureSession = null;
  return session;
};

export const hasGestureEighthWallSession = () => gestureSession != null;
