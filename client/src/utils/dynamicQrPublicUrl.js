/**
 * URL encoded in dynamic QR payloads — mirrors `getCampaignQR` in
 * `server/src/controllers/campaignController.js` (keep branches in sync).
 *
 * @param {object} p
 * @param {string} p.campaignType
 * @param {string|null|undefined} p.redirectSlug
 * @param {string|null|undefined} p.ownerHandle
 * @param {string|null|undefined} p.hubSlug
 * @param {boolean} p.preciseGeoAnalytics
 * @param {string|null|undefined} p.clientBase - SPA origin (CLIENT_URL / VITE_APP_URL / window), no trailing slash
 * @param {string|null|undefined} p.apiRedirectRoot - API origin for `/r/…`, no trailing slash
 */
export function getDynamicQrEncodedUrl({
  campaignType,
  redirectSlug,
  ownerHandle,
  hubSlug,
  preciseGeoAnalytics,
  clientBase,
  apiRedirectRoot,
}) {
  const slug = redirectSlug ? String(redirectSlug) : '';
  if (!slug) return null;

  const types = new Set([
    'single-link-qr',
    'multiple-links-qr',
    'links-video-qr',
    'links-doc-video-qr',
  ]);
  if (!types.has(campaignType)) return null;

  const client = String(clientBase || '').replace(/\/$/, '');
  const apiRoot = String(apiRedirectRoot || '').replace(/\/$/, '');

  const oh = ownerHandle ? String(ownerHandle) : '';
  const hs = hubSlug ? String(hubSlug) : '';

  if (oh && hs && client) {
    return `${client}/open/${oh}/${hs}`;
  }
  if (preciseGeoAnalytics && client) {
    return `${client}/open/${slug}`;
  }
  if (apiRoot) {
    return `${apiRoot}/r/${slug}`;
  }
  return null;
}

const HUB_TYPES = new Set(['multiple-links-qr', 'links-video-qr', 'links-doc-video-qr']);

/**
 * Dashboard "Open link page" for hub types (browser entry, not necessarily identical to QR host if envs differ).
 */
export function getHubDashboardEntryUrl(campaign, clientBaseForOpen) {
  const client = String(clientBaseForOpen || '').replace(/\/$/, '');
  if (!client || !campaign?.redirectSlug) return null;

  const oh = campaign.ownerHandle ? String(campaign.ownerHandle) : '';
  const hs = campaign.hubSlug ? String(campaign.hubSlug) : '';

  if (oh && hs) {
    return `${client}/open/${oh}/${hs}`;
  }
  if (campaign.preciseGeoAnalytics) {
    return `${client}/open/${campaign.redirectSlug}`;
  }
  if (HUB_TYPES.has(campaign.campaignType)) {
    return `${client}/l/${campaign.redirectSlug}`;
  }
  return null;
}

/**
 * Dashboard "Open link" for single-link (SPA `/open/…` when bridge, else API `/r/…`).
 */
export function getSingleLinkDashboardEntryUrl(campaign, clientBaseForOpen, apiRedirectRoot) {
  if (campaign?.campaignType !== 'single-link-qr' || !campaign?.redirectSlug) return null;

  const client = String(clientBaseForOpen || '').replace(/\/$/, '');
  const apiRoot = String(apiRedirectRoot || '').replace(/\/$/, '');
  const oh = campaign.ownerHandle ? String(campaign.ownerHandle) : '';
  const hs = campaign.hubSlug ? String(campaign.hubSlug) : '';

  if (oh && hs && client) {
    return `${client}/open/${oh}/${hs}`;
  }
  if (campaign.preciseGeoAnalytics && client) {
    return `${client}/open/${campaign.redirectSlug}`;
  }
  if (apiRoot) {
    return `${apiRoot}/r/${campaign.redirectSlug}`;
  }
  return null;
}
