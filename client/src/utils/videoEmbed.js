/**
 * Client-side mirror of `[server/src/utils/videoEmbed.js]`.
 *
 * Used by the Links + Video QR wizard to (a) validate the pasted URL inline
 * and (b) render a live `<iframe>` preview before the user submits.  Keeping
 * this in lock-step with the server avoids "preview works but server rejects"
 * surprises.
 *
 * Both files are pure functions, exhaustively tested by manual integration —
 * if you change one, change the other.
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

export const isAllowedVideoHost = (input) => {
  const url = safeParse(input);
  if (!url) return false;
  return ALLOWED_HOST_SET.has(url.hostname.toLowerCase());
};

export const detectVideoHost = (input) => {
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

export const toEmbedSrc = (input) => {
  const url = safeParse(input);
  if (!url) return null;
  const vendor = detectVideoHost(url.toString());
  if (!vendor) return null;

  if (vendor === 'youtube') {
    const id = youtubeIdFromUrl(url);
    if (!id) return null;
    const origin =
      typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
    return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${origin}`;
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

export { ALLOWED_HOSTS };
