/**
 * campaignLoader.js
 * Fetches the public campaign data from the backend API.
 * No auth token required — uses the public endpoint.
 */

import { resolvePlaybackMediaUrl } from '../utils/resolvePlaybackMediaUrl.js';

const API_BASE =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname.includes('onrender.com')
    ? 'https://phygital8thwall-api.onrender.com/api'
    : 'http://localhost:5000/api');

/**
 * loadCampaign — fetches campaign details needed for the AR experience.
 *
 * @param {string} campaignId
 * @returns {Promise<{ campaignName, targetImageUrl, videoUrl, thumbnailUrl }>}
 * @throws  AppError if campaign not found / inactive
 */
export const loadCampaign = async (campaignId) => {
  // No custom headers — keeps the request “simple” so browsers skip a CORS preflight.
  const res = await fetch(`${API_BASE}/public/campaigns/${campaignId}`, { method: 'GET' });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.message || `Campaign load failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const body = await res.json();
  if (!body?.data?.campaign) {
    throw new Error('Invalid response from server.');
  }
  const campaign = body.data.campaign;
  return {
    ...campaign,
    targetImageUrl: resolvePlaybackMediaUrl(campaign.targetImageUrl),
    targetImageOriginalUrl: resolvePlaybackMediaUrl(campaign.targetImageOriginalUrl),
    videoUrl: resolvePlaybackMediaUrl(campaign.videoUrl),
    // iOS-only side-by-side .mov source. May be null on older campaigns —
    // ARExperience falls back to videoUrl when missing.
    videoUrlIos: campaign.videoUrlIos
      ? resolvePlaybackMediaUrl(campaign.videoUrlIos)
      : null,
    thumbnailUrl: resolvePlaybackMediaUrl(campaign.thumbnailUrl),
  };
};

/**
 * recordScan — notifies the server that an AR scan occurred.
 * Non-blocking — called after the experience starts.
 *
 * @param {string} campaignId
 */
export const recordScan = (campaignId, redirectSlug) => {
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

  fetch(`${API_BASE}/public/campaigns/${campaignId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceType,
      browser: navigator.userAgent.slice(0, 100),
      visitorHash: getVisitorHash(redirectSlug),
    }),
  }).catch(() => {}); // intentionally non-blocking
};

/**
 * updateSession — called when the AR experience ends.
 * Sends session duration and video completion % back to the server.
 * Non-blocking — fire and forget.
 *
 * @param {string} campaignId
 * @param {number} sessionDurationMs
 * @param {number} videoWatchPercent   0-100
 */
export const updateSession = (campaignId, sessionDurationMs, videoWatchPercent, redirectSlug) => {
  const visitorHash = getVisitorHash(redirectSlug);
  fetch(`${API_BASE}/public/campaigns/${campaignId}/session`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorHash, sessionDurationMs, videoWatchPercent }),
    // Use keepalive so the request completes even if the page is unloading
    keepalive: true,
  }).catch(() => {});
};

/**
 * recordLinkClick — hub-style outbound link analytics from the AR overlay.
 * Non-blocking — fire and forget.
 *
 * @param {string} redirectSlug
 * @param {string} linkId
 */
export const recordLinkClick = (redirectSlug, linkId) => {
  if (!redirectSlug || !linkId) return;
  fetch(`${API_BASE}/public/multi-link/${encodeURIComponent(redirectSlug)}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      linkId,
      kind: 'link',
      visitorHash: getVisitorHash(redirectSlug),
    }),
    keepalive: true,
  }).catch(() => {});
};

/** Shared with hub bridge — keyed by campaign redirectSlug when available. */
const getVisitorHash = (redirectSlug) => {
  if (redirectSlug) {
    const key = `p8w_vh_${String(redirectSlug)}`;
    let hash = sessionStorage.getItem(key);
    if (!hash) {
      hash = crypto.randomUUID?.()
        || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, hash);
    }
    return hash;
  }
  const key = 'p8w_vid';
  let hash = sessionStorage.getItem(key);
  if (!hash) {
    hash = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, hash);
  }
  return hash;
};
