/**
 * campaignLoader.js
 * Fetches the public campaign data from the backend API.
 * No auth token required — uses the public endpoint.
 */

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
  return body.data.campaign;
};

/**
 * recordScan — notifies the server that an AR scan occurred.
 * Non-blocking — called after the experience starts.
 *
 * @param {string} campaignId
 */
export const recordScan = (campaignId) => {
  const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

  fetch(`${API_BASE}/public/campaigns/${campaignId}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceType,
      browser: navigator.userAgent.slice(0, 100),
      visitorHash: getVisitorHash(),
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
export const updateSession = (campaignId, sessionDurationMs, videoWatchPercent) => {
  const visitorHash = getVisitorHash();
  fetch(`${API_BASE}/public/campaigns/${campaignId}/session`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visitorHash, sessionDurationMs, videoWatchPercent }),
    // Use keepalive so the request completes even if the page is unloading
    keepalive: true,
  }).catch(() => {});
};

/** Returns a session-scoped visitor fingerprint stored in sessionStorage. */
const getVisitorHash = () => {
  const key = 'p8w_vid';
  let hash = sessionStorage.getItem(key);
  if (!hash) {
    hash = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, hash);
  }
  return hash;
};
