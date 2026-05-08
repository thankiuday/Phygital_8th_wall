/**
 * cloudinaryTransform.js — client mirror of the server-side helper. Used for
 * any Cloudinary URL the user is still mid-upload (i.e. the live preview)
 * where the server's transform hasn't yet been applied.
 */

const KNOWN_HOSTS = new Set(['res.cloudinary.com', 'cdn.cloudinary.com']);

const isCloudinaryUrl = (url) => {
  try {
    const u = new URL(url);
    return KNOWN_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
};

const buildSegment = (params = {}) => {
  const out = ['f_auto', 'q_auto'];
  if (params.w) out.push(`w_${params.w}`);
  if (params.h) out.push(`h_${params.h}`);
  if (params.crop) out.push(`c_${params.crop}`);
  if (params.gravity) out.push(`g_${params.gravity}`);
  if (params.dpr) out.push(`dpr_${params.dpr}`);
  return out.join(',');
};

export const cloudinaryTransform = (url, params = {}) => {
  if (typeof url !== 'string' || !url) return url;
  if (!isCloudinaryUrl(url)) return url;
  const segment = buildSegment(params);
  // Cloudinary structure: …/{cloud}/{resource}/{type}/{transforms}/v{v}/{public_id}
  // Inject after `/upload/`. If a transform is already present, prepend ours.
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  return `${url.slice(0, idx + marker.length)}${segment}/${url.slice(idx + marker.length)}`;
};
