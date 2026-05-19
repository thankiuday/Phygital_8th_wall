/**
 * Route private S3 asset URLs through the API media proxy.
 */

const MANAGED_KEY_PREFIX = 'phygital8thwall/';

const getApiOrigin = () => {
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return String(configured).replace(/\/api\/?$/i, '').replace(/\/$/, '');
  }
  if (import.meta.env.DEV) return 'http://localhost:5000';
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
    return 'https://phygital8thwall-api.onrender.com';
  }
  return '';
};

export const resolvePlaybackMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return url;

  const markerIdx = url.indexOf(MANAGED_KEY_PREFIX);
  if (markerIdx === -1) return url;

  let key = url.slice(markerIdx).split('?')[0];
  try {
    key = decodeURIComponent(key);
  } catch {
    /* keep */
  }

  const isDirectS3 = url.includes('.amazonaws.com') || /\.s3[.-]/.test(url);
  const alreadyProxy = url.includes('/api/public/media/');
  if (!isDirectS3 && !alreadyProxy) return url;

  const encoded = key.split('/').map(encodeURIComponent).join('/');
  const path = `/api/public/media/${encoded}`;
  const apiOrigin = getApiOrigin();
  return apiOrigin ? `${apiOrigin}${path}` : path;
};
