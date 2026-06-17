/**
 * surfaceCapability.js — choose surface AR backend per device.
 *
 * Android Chrome: WebXR immersive-ar + hit-test.
 * iOS / iPadOS: surface placement is not offered yet (coming soon).
 */

import { checkWebXrArSupported } from './webxr.js';
import { isApplePlaybackEngine } from './platform.js';

const hasNavigator = () => typeof navigator !== 'undefined';

export const isSurfaceArBlockedOnIos = () => isApplePlaybackEngine();

export const isMobileTouchDevice = () => {
  if (!hasNavigator()) return false;

  const ua = navigator.userAgent || '';
  if (/android|iphone|ipod|ipad|mobile|tablet|silk/i.test(ua)) return true;

  const touchPoints =
    typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  return touchPoints > 1 && /Macintosh|Mac OS X/.test(ua);
};

/**
 * @returns {'webxr' | 'eighthwall-slam' | 'unsupported'}
 */
export const resolveSurfaceArBackend = async () => {
  if (!hasNavigator()) return 'unsupported';

  if (isSurfaceArBlockedOnIos()) return 'unsupported';

  const webxr = await checkWebXrArSupported();
  if (webxr) return 'webxr';

  if (isMobileTouchDevice()) {
    return 'unsupported';
  }

  return 'unsupported';
};

export const isSurfaceArSupported = async () => {
  const backend = await resolveSurfaceArBackend();
  return backend === 'webxr';
};
