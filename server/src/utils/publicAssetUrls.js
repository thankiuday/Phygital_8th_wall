'use strict';

const {
  keyFromManagedAssetUrl,
  needsPresignedGetUrl,
} = require('../services/storageService');

/** API origin for browser media URLs (hub, AR). */
const getApiBaseForMedia = () => {
  const fromEnv = (
    process.env.API_PUBLIC_URL
    || process.env.VERCEL_URL
    || process.env.RENDER_EXTERNAL_URL
    || ''
  ).trim();
  if (fromEnv) {
    const base = fromEnv.replace(/\/$/, '');
    return base.startsWith('http') ? base : `https://${base}`;
  }
  return `http://localhost:${process.env.PORT || 5000}`;
};

/**
 * Stream via same-origin API proxy — reliable for HTML5 video (Range + CORS).
 * Falls back to presigned S3 when proxy URL cannot be built.
 */
const toBrowserMediaUrl = async (storedUrl) => {
  if (!storedUrl || !needsPresignedGetUrl(storedUrl)) return storedUrl;
  const key = keyFromManagedAssetUrl(storedUrl);
  if (!key) return storedUrl;

  const encodedPath = key.split('/').map(encodeURIComponent).join('/');
  return `${getApiBaseForMedia()}/api/public/media/${encodedPath}`;
};

const signField = async (obj, field) => {
  if (obj[field]) {
    obj[field] = await toBrowserMediaUrl(obj[field]);
  }
};

/**
 * Replace direct S3 URLs with presigned GET URLs for public hub / AR consumers.
 * @param {object|null} payload — dynamic-qr meta or public campaign shape
 */
const enrichPublicAssetUrls = async (payload) => {
  if (!payload || typeof payload !== 'object') return payload;

  const out = { ...payload };
  await signField(out, 'videoUrl');
  await signField(out, 'videoUrlIos');
  await signField(out, 'thumbnailUrl');
  await signField(out, 'targetImageUrl');

  if (Array.isArray(out.videoItems)) {
    out.videoItems = await Promise.all(
      out.videoItems.map(async (item) => {
        const vi = { ...item };
        await signField(vi, 'videoUrl');
        await signField(vi, 'thumbnailUrl');
        return vi;
      })
    );
  }

  if (Array.isArray(out.docItems)) {
    out.docItems = await Promise.all(
      out.docItems.map(async (item) => {
        const di = { ...item };
        await signField(di, 'url');
        return di;
      })
    );
  }

  return out;
};

/**
 * Enrich a full Campaign document (dashboard detail, list, PATCH responses).
 */
const enrichCampaignRecord = async (campaign) => {
  if (!campaign || typeof campaign !== 'object') return campaign;

  const out = await enrichPublicAssetUrls(campaign);

  if (Array.isArray(out.videoItems)) {
    out.videoItems = await Promise.all(
      out.videoItems.map(async (item) => {
        const vi = { ...item };
        if (vi.url) vi.url = await toBrowserMediaUrl(vi.url);
        return vi;
      })
    );
  }

  return out;
};

const enrichCampaignList = async (campaigns) => {
  if (!Array.isArray(campaigns)) return campaigns;
  return Promise.all(campaigns.map((c) => enrichCampaignRecord(c)));
};

module.exports = {
  enrichPublicAssetUrls,
  enrichCampaignRecord,
  enrichCampaignList,
};
