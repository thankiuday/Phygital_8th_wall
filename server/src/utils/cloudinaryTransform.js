'use strict';

/**
 * cloudinaryTransform — injects responsive transformation segments into a
 * Cloudinary `secure_url` so mobile clients receive `f_auto,q_auto` (WebP/
 * AVIF when supported) and right-sized variants.
 *
 * Idempotent: passing the same URL twice does not stack transforms; we
 * detect an existing transformation segment after `/upload/` and append a
 * comma-separated set of new tokens to it.
 *
 * If the URL is not a Cloudinary URL (or doesn't match the expected
 * `/upload/` shape) we return it unchanged so this helper is safe to apply
 * unconditionally on any image URL stored in the DB.
 */

const KNOWN_CLOUDINARY_HOSTS = new Set([
  'res.cloudinary.com',
  'cloudinary.com',
]);

const isCloudinaryUrl = (url) => {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    return KNOWN_CLOUDINARY_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
};

/** Build the comma-joined transformation segment from caller options. */
const buildTransformSegment = ({ w, h, dpr = 'auto', crop = 'fill', gravity = 'auto', quality = 'auto', format = 'auto' } = {}) => {
  const tokens = [];
  if (format) tokens.push(`f_${format}`);
  if (quality) tokens.push(`q_${quality}`);
  if (crop) tokens.push(`c_${crop}`);
  if (gravity && (crop === 'fill' || crop === 'thumb' || crop === 'crop')) {
    tokens.push(`g_${gravity}`);
  }
  if (typeof w === 'number' && Number.isFinite(w) && w > 0) tokens.push(`w_${Math.round(w)}`);
  if (typeof h === 'number' && Number.isFinite(h) && h > 0) tokens.push(`h_${Math.round(h)}`);
  if (dpr) tokens.push(`dpr_${dpr}`);
  return tokens.join(',');
};

const cloudinaryTransform = (url, opts = {}) => {
  if (!isCloudinaryUrl(url)) return url;
  const segment = buildTransformSegment(opts);
  if (!segment) return url;

  // Match the `/upload/` boundary; everything between it and the next slash
  // is the existing transformation segment (may be empty for raw uploads).
  const match = url.match(/^(.*\/upload\/)([^/]*\/)?(.+)$/);
  if (!match) return url;
  const [, prefix, existingSegment = '', rest] = match;
  const existing = existingSegment.replace(/\/$/, '');
  const merged = existing ? `${existing},${segment}` : segment;
  return `${prefix}${merged}/${rest}`;
};

module.exports = { cloudinaryTransform, isCloudinaryUrl };
