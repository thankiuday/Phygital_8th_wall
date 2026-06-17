/**
 * Runtime platform helpers for the client app.
 */

const hasNavigator = () => typeof navigator !== 'undefined';

/** iPhone, iPod, iPad, and iPadOS 13+ (Mac UA + touch). */
export const isIOSDevice = () => {
  if (!hasNavigator()) return false;

  const ua = navigator.userAgent || '';
  if (/iPhone|iPod|iPad/.test(ua)) return true;

  const isMacUa = /Macintosh|Mac OS X/.test(ua);
  const touchPoints =
    typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  return isMacUa && touchPoints > 1;
};
