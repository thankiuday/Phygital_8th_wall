'use strict';

const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success, created } = require('../utils/apiResponse');
const { generateUploadSignature, deleteCloudinaryAsset } = require('../services/cloudinaryService');
const { generateQRCode } = require('../services/qrService');
const { redirectCache, dynamicQrMetaCache } = require('../utils/redirectCache');
const logger = require('../config/logger');
const { resolveLinkHref } = require('../utils/linkItemResolver');

/* ── Defense-in-depth: cap on stringified qrDesign size.  Zod already bounds
   the logo `image` field to 180 KB; this is a belt-and-braces guard against a
   schema regression that lets through a giant nested gradient or similar. ── */
const MAX_QR_DESIGN_BYTES = 32_768;

/* ── nanoid is ESM-only as of v4 — we lazy-import once and cache the binding.
   Doing this once at module load (before any request hits us) keeps the create
   handler synchronous-feeling for callers. ── */
let nanoidPromise = null;
const getNanoid = () => {
  if (!nanoidPromise) {
    nanoidPromise = import('nanoid').then((m) => m.customAlphabet(
      // URL-safe, no look-alikes (0/O, 1/l/I), 8 chars → ~218 trillion combos
      '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ',
      8
    ));
  }
  return nanoidPromise;
};

const generateUniqueSlug = async () => {
  const nanoid = await getNanoid();
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = nanoid();
    const exists = await Campaign.exists({ redirectSlug: slug });
    if (!exists) return slug;
    logger.warn('redirectSlug collision — retrying', { slug, attempt });
  }
  throw new AppError('Could not allocate a unique short URL — please retry', 500);
};

/* ─────────────────────────────────────────
   GET /api/campaigns/upload-signature
   ───────────────────────────────────────── */
const getUploadSignature = (req, res) => {
  const { resourceType = 'image' } = req.query;

  if (!['image', 'video'].includes(resourceType)) {
    throw new AppError('resourceType must be "image" or "video"', 400);
  }

  const folder = `phygital8thwall/${req.user._id}/${resourceType}s`;
  const payload = generateUploadSignature({ resourceType, folder });

  return success(res, payload, 'Upload signature generated');
};

/* ─────────────────────────────────────────
   POST /api/campaigns
   Branches on req.body.campaignType (validated upstream by Zod):
     • 'ar-card'        → existing AR flow (Cloudinary assets + async QR)
     • 'single-link-qr' → new dynamic-redirect flow (slug + qrDesign, no Cloudinary)
   ───────────────────────────────────────── */
const createCampaign = async (req, res) => {
  if (req.body.campaignType === 'single-link-qr') {
    return createSingleLinkCampaign(req, res);
  }
  return createArCardCampaign(req, res);
};

const createArCardCampaign = async (req, res) => {
  const {
    campaignName,
    targetImageUrl,
    targetImagePublicId,
    videoUrl,
    videoPublicId,
    thumbnailUrl,
  } = req.body;

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'ar-card',
    campaignName: campaignName.trim(),
    targetImageUrl,
    targetImagePublicId,
    videoUrl,
    videoPublicId,
    thumbnailUrl: thumbnailUrl || null,
    status: 'active',
  });

  generateQRCode(campaign._id.toString(), req.user._id.toString())
    .then(({ qrCodeUrl, qrPublicId }) => {
      campaign.qrCodeUrl = qrCodeUrl;
      campaign.qrPublicId = qrPublicId;
      return campaign.save({ validateModifiedOnly: true });
    })
    .catch((err) => {
      logger.warn('AR QR generation failed', { campaignId: String(campaign._id), error: err.message });
    });

  return created(res, { campaign }, 'Campaign created successfully');
};

const createSingleLinkCampaign = async (req, res) => {
  const { campaignName, destinationUrl, qrDesign, preciseGeoAnalytics } = req.body;

  if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
    throw new AppError(
      `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
      413
    );
  }

  const redirectSlug = await generateUniqueSlug();

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'single-link-qr',
    campaignName: campaignName.trim(),
    destinationUrl, // already normalized + SSRF-checked by Zod transform
    qrDesign: qrDesign || null,
    redirectSlug,
    preciseGeoAnalytics: !!preciseGeoAnalytics,
    status: 'active',
  });

  return created(res, { campaign }, 'Single Link QR campaign created successfully');
};

const persistLinkItemsFromBody = async (linkItems) => {
  const { nanoid } = await import('nanoid');
  const persistedItems = [];
  for (const item of linkItems) {
    const row = {
      linkId: nanoid(12),
      kind: item.kind,
      label: item.label.trim(),
      value: item.value.trim(),
    };
    resolveLinkHref(row.kind, row.value);
    persistedItems.push(row);
  }
  return persistedItems;
};

/**
 * Merge PATCH linkItems with existing hub rows: reuse linkId when the client
 * sends a known id (keeps analytics.linkClickTotals aligned); assign new ids
 * for added rows or spoofed ids. Trims click totals to current linkIds only.
 */
const mergeLinkItemsForUpdate = async (existingItems, incomingItems) => {
  const { nanoid } = await import('nanoid');
  const existingById = new Map((existingItems || []).map((it) => [it.linkId, it]));
  const assigned = new Set();
  const merged = [];

  for (const item of incomingItems) {
    const label = item.label.trim();
    const value = item.value.trim();
    resolveLinkHref(item.kind, value);

    let linkId = null;
    const claimed = item.linkId && typeof item.linkId === 'string' ? item.linkId.trim() : '';
    if (claimed && existingById.has(claimed) && !assigned.has(claimed)) {
      linkId = claimed;
    } else {
      linkId = nanoid(12);
      while (assigned.has(linkId) || existingById.has(linkId)) {
        linkId = nanoid(12);
      }
    }
    assigned.add(linkId);
    merged.push({ linkId, kind: item.kind, label, value });
  }

  return merged;
};

const pruneLinkClickTotals = (totals, linkIds) => {
  const next = {};
  if (totals && typeof totals === 'object' && !Array.isArray(totals)) {
    for (const id of linkIds) {
      if (Object.prototype.hasOwnProperty.call(totals, id)) {
        next[id] = totals[id];
      }
    }
  }
  return next;
};

const createMultipleLinksCampaign = async (req, res) => {
  const { campaignName, linkItems, qrDesign, preciseGeoAnalytics } = req.body;

  if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
    throw new AppError(
      `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
      413
    );
  }

  const persistedItems = await persistLinkItemsFromBody(linkItems);
  const redirectSlug = await generateUniqueSlug();

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'multiple-links-qr',
    campaignName: campaignName.trim(),
    linkItems: persistedItems,
    qrDesign: qrDesign || null,
    redirectSlug,
    preciseGeoAnalytics: !!preciseGeoAnalytics,
    status: 'active',
  });

  return created(res, { campaign }, 'Multiple Links QR campaign created successfully');
};

/* ─────────────────────────────────────────
   GET /api/campaigns
   ───────────────────────────────────────── */
const getCampaigns = async (req, res) => {
  const { status, campaignType, page = 1, limit = 12 } = req.query;

  const filter = { userId: req.user._id };
  if (status && ['draft', 'active', 'paused'].includes(status)) {
    filter.status = status;
  }
  if (
    campaignType
    && ['ar-card', 'single-link-qr', 'multiple-links-qr'].includes(campaignType)
  ) {
    filter.campaignType = campaignType;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Campaign.countDocuments(filter),
  ]);

  return success(res, {
    campaigns,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
};

/* ─────────────────────────────────────────
   GET /api/campaigns/:id
   ───────────────────────────────────────── */
const getCampaign = async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();

  if (!campaign) throw new AppError('Campaign not found', 404);

  return success(res, { campaign });
};

/* ─────────────────────────────────────────
   PATCH /api/campaigns/:id
   Body shape validated by updateCampaignSchema (Zod).
   ───────────────────────────────────────── */
const updateCampaign = async (req, res) => {
  const existing = await Campaign.findOne(
    { _id: req.params.id, userId: req.user._id },
    'campaignType redirectSlug status linkItems analytics.linkClickTotals'
  ).lean();
  if (!existing) throw new AppError('Campaign not found', 404);

  const {
    campaignName,
    status,
    destinationUrl,
    qrDesign,
    preciseGeoAnalytics,
    linkItems,
  } = req.body;
  const updates = {};

  if (campaignName !== undefined) updates.campaignName = campaignName;
  if (status !== undefined) updates.status = status;

  // Type-gated fields — silently ignored on the wrong type to keep the contract
  // forgiving (the frontend re-uses one PATCH for all campaign types).
  if (existing.campaignType === 'single-link-qr') {
    if (destinationUrl !== undefined) updates.destinationUrl = destinationUrl;
    if (preciseGeoAnalytics !== undefined) updates.preciseGeoAnalytics = !!preciseGeoAnalytics;
    if (qrDesign !== undefined) {
      if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
        throw new AppError(
          `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
          413
        );
      }
      updates.qrDesign = qrDesign;
    }
  }

  if (existing.campaignType === 'multiple-links-qr') {
    if (preciseGeoAnalytics !== undefined) updates.preciseGeoAnalytics = !!preciseGeoAnalytics;
    if (qrDesign !== undefined) {
      if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
        throw new AppError(
          `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
          413
        );
      }
      updates.qrDesign = qrDesign;
    }
    if (linkItems !== undefined) {
      const merged = await mergeLinkItemsForUpdate(existing.linkItems, linkItems);
      updates.linkItems = merged;
      updates['analytics.linkClickTotals'] = pruneLinkClickTotals(
        existing.analytics?.linkClickTotals,
        merged.map((m) => m.linkId)
      );
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  );

  // Evict cache after a successful write so the next scan picks up the new
  // destination / hub data / status.
  if (
    (existing.campaignType === 'single-link-qr'
      || existing.campaignType === 'multiple-links-qr')
    && existing.redirectSlug
  ) {
    redirectCache.evict(existing.redirectSlug).catch(() => {});
    dynamicQrMetaCache.evict(existing.redirectSlug).catch(() => {});
  }

  return success(res, { campaign }, 'Campaign updated');
};

/* ─────────────────────────────────────────
   DELETE /api/campaigns/:id
   ───────────────────────────────────────── */
const deleteCampaign = async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
  if (!campaign) throw new AppError('Campaign not found', 404);

  // Cloudinary cleanup only applies to AR campaigns.
  if (campaign.campaignType === 'ar-card') {
    await Promise.allSettled([
      deleteCloudinaryAsset(campaign.targetImagePublicId, 'image'),
      deleteCloudinaryAsset(campaign.videoPublicId, 'video'),
    ]);
  }

  if (campaign.redirectSlug) {
    redirectCache.evict(campaign.redirectSlug).catch(() => {});
    dynamicQrMetaCache.evict(campaign.redirectSlug).catch(() => {});
  }

  await campaign.deleteOne();

  return success(res, {}, 'Campaign deleted');
};

/* ─────────────────────────────────────────
   POST /api/campaigns/:id/duplicate
   ───────────────────────────────────────── */
const duplicateCampaign = async (req, res) => {
  const original = await Campaign.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();

  if (!original) throw new AppError('Campaign not found', 404);

  if (original.campaignType === 'single-link-qr') {
    const redirectSlug = await generateUniqueSlug();
    const copy = await Campaign.create({
      userId: original.userId,
      campaignType: 'single-link-qr',
      campaignName: `Copy of ${original.campaignName}`,
      destinationUrl: original.destinationUrl,
      qrDesign: original.qrDesign,
      redirectSlug,
      preciseGeoAnalytics: !!original.preciseGeoAnalytics,
      status: 'active',
    });
    return created(res, { campaign: copy }, 'Campaign duplicated successfully');
  }

  if (original.campaignType === 'multiple-links-qr') {
    const { nanoid } = await import('nanoid');
    const redirectSlug = await generateUniqueSlug();
    const items = (original.linkItems || []).map((it) => ({
      linkId: nanoid(12),
      kind: it.kind,
      label: it.label,
      value: it.value,
    }));
    const copy = await Campaign.create({
      userId: original.userId,
      campaignType: 'multiple-links-qr',
      campaignName: `Copy of ${original.campaignName}`,
      linkItems: items,
      qrDesign: original.qrDesign,
      redirectSlug,
      preciseGeoAnalytics: !!original.preciseGeoAnalytics,
      status: 'active',
    });
    return created(res, { campaign: copy }, 'Campaign duplicated successfully');
  }

  const copy = await Campaign.create({
    userId: original.userId,
    campaignType: 'ar-card',
    campaignName: `Copy of ${original.campaignName}`,
    targetImageUrl:       original.targetImageUrl,
    targetImagePublicId:  original.targetImagePublicId,
    videoUrl:             original.videoUrl,
    videoPublicId:        original.videoPublicId,
    thumbnailUrl:         original.thumbnailUrl,
    status: 'active',
  });

  generateQRCode(copy._id.toString(), req.user._id.toString())
    .then(({ qrCodeUrl, qrPublicId }) => {
      copy.qrCodeUrl  = qrCodeUrl;
      copy.qrPublicId = qrPublicId;
      return copy.save({ validateModifiedOnly: true });
    })
    .catch((err) => {
      logger.warn('AR QR generation failed for duplicate', {
        campaignId: String(copy._id),
        error: err.message,
      });
    });

  return created(res, { campaign: copy }, 'Campaign duplicated successfully');
};

/* ─────────────────────────────────────────
   GET /api/campaigns/:id/qr
   AR campaigns: returns the Cloudinary-hosted PNG once async generation finishes.
   Single-link campaigns: returns the encoded redirect URL so the client can
   render the QR locally via qr-code-styling.
   ───────────────────────────────────────── */
const getCampaignQR = async (req, res) => {
  const campaign = await Campaign.findOne(
    { _id: req.params.id, userId: req.user._id },
    'qrCodeUrl qrPublicId campaignName campaignType redirectSlug qrDesign preciseGeoAnalytics'
  ).lean();

  if (!campaign) throw new AppError('Campaign not found', 404);

  if (
    campaign.campaignType === 'single-link-qr'
    || campaign.campaignType === 'multiple-links-qr'
  ) {
    const apiBase = process.env.PUBLIC_REDIRECT_BASE
      || process.env.API_URL
      || `${req.protocol}://${req.get('host')}`;
    const apiRoot = apiBase.replace(/\/$/, '');
    const clientBase = (process.env.CLIENT_URL || '').replace(/\/$/, '');

    let redirectUrl;
    if (campaign.preciseGeoAnalytics && clientBase) {
      redirectUrl = `${clientBase}/open/${campaign.redirectSlug}`;
    } else {
      redirectUrl = `${apiRoot}/r/${campaign.redirectSlug}`;
    }

    return success(res, {
      campaignType: campaign.campaignType,
      redirectUrl,
      redirectSlug: campaign.redirectSlug,
      qrDesign: campaign.qrDesign,
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      ready: true,
    });
  }

  return success(res, {
    campaignType: 'ar-card',
    qrCodeUrl: campaign.qrCodeUrl,
    qrPublicId: campaign.qrPublicId,
    ready: !!campaign.qrCodeUrl,
  });
};

module.exports = {
  getUploadSignature,
  createCampaign,
  createSingleLinkCampaign,
  createMultipleLinksCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaignQR,
};
