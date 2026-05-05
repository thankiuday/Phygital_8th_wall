'use strict';

/**
 * videoEmbed — strict allowlist + parser for hero-video URLs in
 * `links-video-qr` campaigns.
 *
 * Why an allowlist instead of letting any URL through:
 *  - We render the resolved `embedSrc` inside an `<iframe>` on the public hub
 *    page, so an attacker-controlled URL would have full DOM access in that
 *    iframe.  Restricting to a curated set of providers keeps the security
 *    boundary tight.
 *  - The video-engagement beacon path (HubVideoPlayer) only knows how to
 *    instrument YouTube / Vimeo / native HTML5 / Facebook (click-only).
 *
 * `toEmbedSrc(url)` returns either a normalized https iframe src or `null`.
 *
 * The client mirrors this exact logic (see [client/src/utils/videoEmbed.js])
 * so we can preview the iframe inside the wizard without an extra round-trip.
 */

const ALLOWED_HOSTS = Object.freeze([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
  'facebook.com',
  'www.facebook.com',
  'fb.watch',
]);

const ALLOWED_HOST_SET = new Set(ALLOWED_HOSTS);

const safeParse = (input) => {
  if (typeof input !== 'string' || !input.trim()) return null;
  let raw = input.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) raw = `https://${raw}`;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
};

/** True when the URL parses and its hostname is in the curated allowlist. */
const isAllowedVideoHost = (input) => {
  const url = safeParse(input);
  if (!url) return false;
  return ALLOWED_HOST_SET.has(url.hostname.toLowerCase());
};

/** Best-effort vendor classification used by HubVideoPlayer for the right SDK. */
const detectVideoHost = (input) => {
  const url = safeParse(input);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (host.endsWith('youtube.com') || host === 'youtu.be' || host.endsWith('youtube-nocookie.com')) {
    return 'youtube';
  }
  if (host.endsWith('vimeo.com')) return 'vimeo';
  if (host.endsWith('facebook.com') || host === 'fb.watch') return 'facebook';
  return null;
};

const YT_ID_RE = /^[A-Za-z0-9_-]{6,32}$/;

const youtubeIdFromUrl = (url) => {
  const host = url.hostname.toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\/+/, '').split('/')[0];
    return YT_ID_RE.test(id) ? id : null;
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      return id && YT_ID_RE.test(id) ? id : null;
    }
    const m = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
    if (m && YT_ID_RE.test(m[1])) return m[1];
  }
  return null;
};

const vimeoIdFromUrl = (url) => {
  const m = url.pathname.match(/^\/(?:video\/)?(\d{4,12})(?:\/|$)/);
  return m ? m[1] : null;
};

/**
 * toEmbedSrc(url)
 * ---------------
 * Returns a sanitized iframe src on success, `null` on failure.  Never throws.
 *
 *  - YouTube  → https://www.youtube-nocookie.com/embed/<id>?rel=0&playsinline=1
 *  - Vimeo    → https://player.vimeo.com/video/<id>
 *  - Facebook → https://www.facebook.com/plugins/video.php?href=<encoded>&show_text=false
 */
const toEmbedSrc = (input) => {
  const url = safeParse(input);
  if (!url) return null;
  const vendor = detectVideoHost(url.toString());
  if (!vendor) return null;

  if (vendor === 'youtube') {
    const id = youtubeIdFromUrl(url);
    if (!id) return null;
    // Use youtube.com (not nocookie) so strict videos don't fail with player
    // config/referrer checks on embedded playback.
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
  }
  if (vendor === 'vimeo') {
    const id = vimeoIdFromUrl(url);
    if (!id) return null;
    return `https://player.vimeo.com/video/${id}?dnt=1&playsinline=1`;
  }
  if (vendor === 'facebook') {
    const href = encodeURIComponent(url.toString());
    return `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&autoplay=false`;
  }
  return null;
};

module.exports = {
  ALLOWED_HOSTS,
  isAllowedVideoHost,
  detectVideoHost,
  toEmbedSrc,
};
