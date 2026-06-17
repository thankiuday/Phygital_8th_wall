/**
 * surfaceCapability.js — choose surface AR backend per device.
 *
 * Android Chrome: WebXR immersive-ar + hit-test.
 * iOS / iPadOS / other mobile without WebXR: 8th Wall SLAM binary.
 */

import { checkWebXrArSupported } from './webxr.js';
import { isApplePlaybackEngine } from './platform.js';

const hasNavigator = () => typeof navigator !== 'undefined';

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

  const webxr = await checkWebXrArSupported();
  if (webxr) return 'webxr';

  if (isMobileTouchDevice() || isApplePlaybackEngine()) {
    return 'eighthwall-slam';
  }

  return 'unsupported';
};

export const isSurfaceArSupported = async () => {
  const backend = await resolveSurfaceArBackend();
  return backend === 'webxr' || backend === 'eighthwall-slam';
};
