/**
 * assetUrl — passthrough for stored asset URLs (S3 / CloudFront).
 * Cloudinary-style transforms are not applied; use CSS sizing on the client.
 */
export const assetUrl = (url, _params = {}) => url;

const MANAGED_KEY_PREFIX = 'phygital8thwall/';

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return String(configured).replace(/\/api\/?$/i, '').replace(/\/$/, '');
  }
  if (import.meta.env.DEV) return '';
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
};

/**
 * Route private S3 URLs through the API media proxy (hub, AR, previews).
 * Required when the bucket blocks public access.
 */
export const resolvePlaybackMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return url;

  const markerIdx = url.indexOf(MANAGED_KEY_PREFIX);
  if (markerIdx === -1) return url;

  let key = url.slice(markerIdx).split('?')[0];
  try {
    key = decodeURIComponent(key);
  } catch {
    /* keep raw key */
  }

  const isDirectS3 = url.includes('.amazonaws.com') || /\.s3[.-]/.test(url);
  const alreadyProxy = url.includes('/api/public/media/');
  if (!isDirectS3 && !alreadyProxy) return url;

  const encoded = key.split('/').map(encodeURIComponent).join('/');
  const path = `/api/public/media/${encoded}`;

  const apiOrigin = getApiOrigin();
  if (import.meta.env.DEV && !apiOrigin) return path;
  if (apiOrigin) return `${apiOrigin}${path}`;
  return path;
};

/** @deprecated Use resolvePlaybackMediaUrl */
export const preferLocalApiMediaUrl = resolvePlaybackMediaUrl;

export const isManagedAssetUrl = (url) => {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
};

/** @deprecated Use assetUrl */
export const cloudinaryTransform = assetUrl;
