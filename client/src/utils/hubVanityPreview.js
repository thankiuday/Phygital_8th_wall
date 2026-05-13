/**
 * Client-side slug preview for vanity hub URLs (mirrors server `slugifyCampaignName`).
 * Final slug may differ if the name collides with your other campaigns.
 */
export function slugifyCampaignNamePreview(name) {
  const base = String(name || 'campaign')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (base.length >= 3) return base;
  return 'campaign';
}
