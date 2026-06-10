import { isArMediaType } from '../constants/arMediaProducts';
import { resolveClientAppBase } from './clientAppBase';
import {
  getHubDashboardEntryUrl,
  getSingleLinkDashboardEntryUrl,
} from './dynamicQrPublicUrl';

export { isArMediaType };

export const resolveRedirectBase = () => {
  if (import.meta.env.VITE_REDIRECT_BASE) {
    return String(import.meta.env.VITE_REDIRECT_BASE).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const HUB_QR_TYPES = new Set([
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
]);

const DYNAMIC_QR_TYPES = new Set([
  'single-link-qr',
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
  'digital-business-card',
]);

export const isHubQrType = (type) =>
  HUB_QR_TYPES.has(type) || isArMediaType(type);

export const isDynamicQrType = (type) => DYNAMIC_QR_TYPES.has(type);

export const isContentTabType = (type) =>
  type === 'single-link-qr'
  || HUB_QR_TYPES.has(type)
  || isArMediaType(type);

export const arPreviewUrl = (campaign) =>
  campaign?._id ? `/ar/${campaign._id}` : null;

export const cardPublicUrl = (campaign) =>
  campaign?.campaignType === 'digital-business-card' && campaign?.cardSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/card/${campaign.cardSlug}`
    : null;

export const hubPublicUrl = (campaign) =>
  getHubDashboardEntryUrl(campaign, resolveClientAppBase());

export const singleLinkPublicUrl = (campaign) =>
  getSingleLinkDashboardEntryUrl(campaign, resolveClientAppBase(), resolveRedirectBase());

export const primaryOpenUrl = (campaign) => {
  if (!campaign) return null;
  if (campaign.campaignType === 'digital-business-card') return cardPublicUrl(campaign);
  if (isHubQrType(campaign.campaignType)) return hubPublicUrl(campaign);
  if (campaign.campaignType === 'single-link-qr') return singleLinkPublicUrl(campaign);
  return null;
};

export const canPreviewAr = (campaign) => {
  if (!campaign || campaign.status !== 'active') return false;
  if (isArMediaType(campaign.campaignType)) return true;
  // Legacy non-dynamic campaigns that use the /ar/:id experience route
  if (!isDynamicQrType(campaign.campaignType)) return true;
  return false;
};

export const hasPrintAsset = (campaign) =>
  isArMediaType(campaign?.campaignType) && !!campaign?.targetImageUrl;

export const CAMPAIGN_TYPE_LABELS = {
  'ar-card': 'AR Card',
  'ar-poster': 'AR Poster',
  'single-link-qr': 'Single Link',
  'multiple-links-qr': 'Multi Links',
  'links-video-qr': 'Links + Video',
  'links-doc-video-qr': 'Links + Doc + Video',
  'digital-business-card': 'Digital Card',
};

export const campaignTypeLabel = (type) =>
  CAMPAIGN_TYPE_LABELS[type] || type || 'Campaign';
