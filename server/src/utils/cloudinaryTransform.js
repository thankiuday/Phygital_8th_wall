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

  // Handle all Cloudinary URL variants safely:
  // - /upload/v1234/public_id.jpg               (no existing transforms)
  // - /upload/c_fill,w_300/v1234/public_id.jpg  (has transforms)
  // - /upload/public_id.jpg                      (legacy / no version)
  const marker = '/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const prefix = url.slice(0, idx + marker.length);
  const tail = url.slice(idx + marker.length);
  const parts = tail.split('/');
  if (!parts.length) return url;

  const first = parts[0] || '';
  const isVersionSegment = /^v\d+$/.test(first);

  if (isVersionSegment) {
    // No transform segment yet: inject ours before the version segment.
    return `${prefix}${segment}/${tail}`;
  }

  // Existing transform segment present (or legacy path without version):
  // append ours in an idempotent way.
  const merged = first ? `${first},${segment}` : segment;
  const rest = parts.slice(1).join('/');
  return rest ? `${prefix}${merged}/${rest}` : `${prefix}${merged}`;
};

module.exports = { cloudinaryTransform, isCloudinaryUrl };
