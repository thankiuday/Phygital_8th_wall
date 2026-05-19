'use strict';

/**
 * assetUrl — public asset URL helper (replaces Cloudinary transforms).
 * S3/CloudFront URLs are returned unchanged; optional query params when
 * AWS_CLOUDFRONT_IMAGE_RESIZE=true and host matches public base.
 */

let publicHost = null;
const getPublicHost = () => {
  if (publicHost !== null) return publicHost;
  try {
    const { getPublicBaseUrl } = require('../config/s3');
    publicHost = new URL(getPublicBaseUrl()).hostname;
  } catch {
    publicHost = '';
  }
  return publicHost;
};

const isManagedAssetUrl = (url) => {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    const host = getPublicHost();
    if (host && u.hostname === host) return true;
    if (u.hostname.endsWith('.amazonaws.com')) return true;
    return false;
  } catch {
    return false;
  }
};

/**
 * @param {string} url
 * @param {{ w?: number, h?: number }} opts — reserved for future CDN resize
 */
const assetUrl = (url, opts = {}) => {
  if (!url || !isManagedAssetUrl(url)) return url;
  if (process.env.AWS_CLOUDFRONT_IMAGE_RESIZE !== 'true') return url;

  const params = new URLSearchParams();
  if (opts.w) params.set('w', String(Math.round(opts.w)));
  if (opts.h) params.set('h', String(Math.round(opts.h)));
  if (!params.toString()) return url;

  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}${params.toString()}`;
};

module.exports = { assetUrl, isManagedAssetUrl };
