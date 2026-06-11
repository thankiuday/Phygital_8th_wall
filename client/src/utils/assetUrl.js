/**
 * assetUrl — passthrough for stored asset URLs (S3 / CloudFront).
 * Cloudinary-style transforms are not applied; use CSS sizing on the client.
 */
export const assetUrl = (url, _params = {}) => url;

const MANAGED_KEY_PREFIX = 'phygital8thwall/';

const getApiOrigin = () => {
  const forceRemote = import.meta.env.VITE_USE_REMOTE_API === 'true';
  if (import.meta.env.DEV && !forceRemote && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    return String(configured).replace(/\/api\/?$/i, '').replace(/\/$/, '');
  }
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

const VIDEO_MEDIA_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;

/** True when URL points at a video object (not usable in &lt;img&gt;). */
export const isVideoMediaUrl = (url) => {
  if (typeof url !== 'string' || !url) return false;
  return VIDEO_MEDIA_RE.test(url.split('#')[0]);
};

/**
 * Best image URL for cards / previews: real image thumb, else AR target image.
 */
export const pickCampaignImageThumbUrl = (campaign) => {
  const candidates = [
    campaign?.thumbnailUrl,
    campaign?.targetImageUrl,
  ];
  for (const raw of candidates) {
    if (!raw || isVideoMediaUrl(raw)) continue;
    return resolvePlaybackMediaUrl(raw);
  }
  return null;
};

/**
 * Fallback video URL for poster-style previews when no image thumb exists.
 */
export const pickCampaignVideoPreviewUrl = (campaign) => {
  if (pickCampaignImageThumbUrl(campaign)) return null;
  const candidates = [campaign?.videoUrl, campaign?.thumbnailUrl];
  for (const raw of candidates) {
    if (!raw || !isVideoMediaUrl(raw)) continue;
    return resolvePlaybackMediaUrl(raw);
  }
  return null;
};

/** Normalize campaign media fields after GET (dashboard detail / list). */
export const enrichCampaignMedia = (campaign) => {
  if (!campaign || typeof campaign !== 'object') return campaign;

  const mapUrl = (url) => (url ? resolvePlaybackMediaUrl(url) : url);

  const out = {
    ...campaign,
    videoUrl: mapUrl(campaign.videoUrl),
    videoUrlIos: mapUrl(campaign.videoUrlIos),
    thumbnailUrl: mapUrl(campaign.thumbnailUrl),
    targetImageUrl: mapUrl(campaign.targetImageUrl),
    qrCodeUrl: mapUrl(campaign.qrCodeUrl),
  };

  if (Array.isArray(campaign.videoItems)) {
    out.videoItems = campaign.videoItems.map((vi) => ({
      ...vi,
      url: mapUrl(vi.url),
      videoUrl: mapUrl(vi.videoUrl),
      thumbnailUrl: mapUrl(vi.thumbnailUrl),
    }));
  }

  if (Array.isArray(campaign.docItems)) {
    out.docItems = campaign.docItems.map((di) => ({
      ...di,
      url: mapUrl(di.url),
    }));
  }

  return out;
};

/** Resolve card profile/banner URLs for display (blob preview or proxied S3). */
export const resolveCardImageUrl = (preview, url) => {
  if (preview) return preview;
  if (url) return resolvePlaybackMediaUrl(url);
  return null;
};
