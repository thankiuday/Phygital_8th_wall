'use strict';

const crypto = require('crypto');
const { cloudinary, configureCloudinary } = require('../config/cloudinary');

// Ensure Cloudinary is configured before any upload calls
configureCloudinary();

/* ─────────────────────────────────────────
   SIGNED UPLOAD — generate a signature so the
   client can upload directly to Cloudinary CDN.
   The raw API secret never leaves the server.
   ───────────────────────────────────────── */

/**
 * generateUploadSignature
 *
 * Returns params the client needs to POST a file directly to:
 *   https://api.cloudinary.com/v1_1/<cloud_name>/<resource_type>/upload
 *
 * @param {object} options
 * @param {'image'|'video'|'raw'} options.resourceType
 * @param {string}                options.folder       — Cloudinary folder path
 * @param {number}                [options.maxBytes]   — optional byte limit (not enforced server-side but included for reference)
 */
const generateUploadSignature = (options) => {
  const {
    resourceType = 'image',
    folder,
    tags = [],
    context = null,
  } = options;

  const timestamp = Math.round(Date.now() / 1000);
  const normalizedTags = Array.isArray(tags)
    ? tags.map((t) => String(t || '').trim()).filter(Boolean)
    : [];
  const tagsCsv = normalizedTags.length ? normalizedTags.join(',') : null;
  const contextValue = context && typeof context === 'object'
    ? Object.entries(context)
      .map(([k, v]) => `${String(k).trim()}=${String(v ?? '').trim()}`)
      .filter(Boolean)
      .join('|')
    : null;

  // Build the string-to-sign — params must be alphabetically sorted
  const paramsToSign = {
    folder,
    timestamp,
  };
  if (tagsCsv) paramsToSign.tags = tagsCsv;
  if (contextValue) paramsToSign.context = contextValue;

  const stringToSign = Object.entries(paramsToSign)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const signature = crypto
    .createHash('sha256')
    .update(stringToSign + process.env.CLOUDINARY_API_SECRET)
    .digest('hex');

  return {
    signature,
    timestamp,
    folder,
    tags: tagsCsv,
    context: contextValue,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    resourceType,
  };
};

const DRAFT_ASSET_TAG = 'draft-temp';
const PERMANENT_ASSET_TAG = 'draft-claimed';

const toUniqueIds = (ids = []) => [...new Set(
  (Array.isArray(ids) ? ids : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean)
)];

const claimUploadedDraftAssets = async ({ image = [], video = [], raw = [] } = {}) => {
  const byType = [
    { resourceType: 'image', ids: toUniqueIds(image) },
    { resourceType: 'video', ids: toUniqueIds(video) },
    { resourceType: 'raw', ids: toUniqueIds(raw) },
  ];

  for (const { resourceType, ids } of byType) {
    if (!ids.length) continue;
    await cloudinary.api.add_tag(PERMANENT_ASSET_TAG, ids, { resource_type: resourceType });
    await cloudinary.api.remove_tag(DRAFT_ASSET_TAG, ids, { resource_type: resourceType });
  }
};

const cleanupDraftAssetsByAge = async ({ maxAgeHours = 24, maxPerRun = 100 } = {}) => {
  const cutoffMs = Date.now() - (Math.max(1, Number(maxAgeHours)) * 60 * 60 * 1000);
  const resourceTypes = ['image', 'video', 'raw'];
  let deletedCount = 0;

  for (const resourceType of resourceTypes) {
    if (deletedCount >= maxPerRun) break;
    const list = await cloudinary.api.resources_by_tag(DRAFT_ASSET_TAG, {
      resource_type: resourceType,
      max_results: 500,
    });
    const resources = Array.isArray(list?.resources) ? list.resources : [];
    const staleIds = resources
      .filter((r) => {
        const createdAt = Date.parse(r?.created_at || '');
        return Number.isFinite(createdAt) && createdAt <= cutoffMs;
      })
      .slice(0, Math.max(0, maxPerRun - deletedCount))
      .map((r) => r.public_id)
      .filter(Boolean);
    if (!staleIds.length) continue;
    await cloudinary.api.delete_resources(staleIds, { resource_type: resourceType, type: 'upload' });
    deletedCount += staleIds.length;
  }

  return { deletedCount };
};

/* ─────────────────────────────────────────
   SERVER-SIDE DELETE — remove an asset from
   Cloudinary when a campaign is deleted.
   ───────────────────────────────────────── */

/**
 * deleteCloudinaryAsset
 * @param {string}                publicId
 * @param {'image'|'video'|'raw'} resourceType
 */
const deleteCloudinaryAsset = async (publicId, resourceType = 'image') => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    console.error(`Cloudinary delete failed for ${publicId}:`, err.message);
  }
};

module.exports = {
  DRAFT_ASSET_TAG,
  generateUploadSignature,
  deleteCloudinaryAsset,
  claimUploadedDraftAssets,
  cleanupDraftAssetsByAge,
};
