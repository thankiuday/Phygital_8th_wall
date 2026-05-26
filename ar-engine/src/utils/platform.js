/**
 * platform.js — runtime device / engine detection for AR playback.
 *
 * Why this exists
 * ---------------
 * iOS Safari's HTML5 <video> element decodes ProRes / HEVC-alpha MOVs but
 * does NOT honour the alpha channel when painting over the AR camera feed —
 * the transparent pixels render solid black. There is no <video> flag, no
 * codec, and no encoding trick that fixes this on iOS. Every shipped iOS
 * WebAR product (8thWall, Niantic, Zappar) works around it by playing a
 * regular H.264 .mov whose alpha mask is encoded as a grayscale image in
 * the right half of each frame, then recombining RGB + mask inside a
 * <canvas> / WebGL shader.
 *
 * `isApplePlaybackEngine()` returns true whenever the page is being rendered
 * by Mobile WebKit — iPhone, iPod, iPad on iOS<13 (legacy UA), iPad on
 * iPadOS 13+ (Mac UA with touch), and standalone PWAs. Desktop Safari on
 * macOS is excluded because the AR experience requires a touch device.
 */

const hasNavigator = () => typeof navigator !== 'undefined';

/**
 * True when the device should play the iOS .mov + canvas-shader fallback.
 *
 * Detection layers:
 *  1. iPhone / iPod / iPad in the UA string — covers iOS 12 and earlier.
 *  2. iPadOS 13+ — reports as Macintosh; disambiguated by maxTouchPoints>1
 *     because no real Mac trackpad reports touch points to the DOM.
 *  3. Generic Apple WebKit token — caught above; we intentionally do NOT
 *     match plain `Safari/` because Chrome on iOS uses the same string.
 *
 * Note: We test platform/UA defensively because some webviews override
 * userAgent and some embedded browsers don't expose maxTouchPoints.
 */
export const isApplePlaybackEngine = () => {
  if (!hasNavigator()) return false;

  const ua = navigator.userAgent || '';

  // Layer 1 — iPhone / iPod / pre-iPadOS-13 iPads
  if (/iPhone|iPod/.test(ua)) return true;
  if (/iPad/.test(ua)) return true;

  // Layer 2 — iPadOS 13+ pretends to be a Mac
  const isMacUa = /Macintosh|Mac OS X/.test(ua);
  const touchPoints =
    typeof navigator.maxTouchPoints === 'number' ? navigator.maxTouchPoints : 0;
  if (isMacUa && touchPoints > 1) return true;

  return false;
};
