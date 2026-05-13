'use strict';

const crypto = require('crypto');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const ScanEvent = require('../models/ScanEvent');
const LinkClickEvent = require('../models/LinkClickEvent');
const VideoPlayEvent = require('../models/VideoPlayEvent');
const { AppError } = require('../middleware/errorHandler');
const { success, created } = require('../utils/apiResponse');
const {
  DRAFT_ASSET_TAG,
  generateUploadSignature,
  deleteCloudinaryAsset,
  claimUploadedDraftAssets,
} = require('../services/cloudinaryService');
const { generateQRCode } = require('../services/qrService');
const { redirectCache, dynamicQrMetaCache, cardMetaCache } = require('../utils/redirectCache');
const { renderCardPng } = require('../services/cardPrintService');
const { CARD_SIZE_IDS, DEFAULT_CARD_SIZE } = require('../constants/cardSizes');
const logger = require('../config/logger');
const { resolveLinkHref } = require('../utils/linkItemResolver');
const { allocateUniqueHandleFromEmail } = require('../utils/userHandle');
const { allocateUniqueHubSlugForUser } = require('../utils/campaignHubSlug');

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

const evictDynamicQrMetaForCampaign = (row) => {
  if (!row?.redirectSlug) return;
  dynamicQrMetaCache.evict(row.redirectSlug).catch(() => {});
  if (row.ownerHandle && row.hubSlug) {
    dynamicQrMetaCache.evict(`v:${row.ownerHandle}/${row.hubSlug}`).catch(() => {});
  }
};

/** Allocate `ownerHandle` (from User) + unique `hubSlug` for vanity `/open/...` URLs. */
const ensureOwnerHubFields = async (userId, campaignNameTrimmed) => {
  const userDoc = await User.findById(userId).select('handle email').lean();
  if (!userDoc) throw new AppError('User not found', 401);
  let ownerHandle = userDoc.handle;
  if (!ownerHandle) {
    const u = await User.findById(userId).select('email');
    if (!u) throw new AppError('User not found', 401);
    ownerHandle = await allocateUniqueHandleFromEmail(User, u.email);
    await User.updateOne({ _id: userId }, { $set: { handle: ownerHandle } });
  }
  const hubSlug = await allocateUniqueHubSlugForUser(Campaign, userId, campaignNameTrimmed);
  return { ownerHandle, hubSlug };
};

/* ─────────────────────────────────────────
   GET /api/campaigns/upload-signature
   ───────────────────────────────────────── */
const getUploadSignature = (req, res) => {
  const { resourceType = 'image' } = req.query;
  const isDraftUpload = req.query.draft === '1' || req.query.draft === 'true';

  // `raw` is required for document uploads (PDF / Office files) in the
  // links-doc-video-qr flow; everything else keeps its historical bucket.
  if (!['image', 'video', 'raw'].includes(resourceType)) {
    throw new AppError('resourceType must be "image", "video", or "raw"', 400);
  }

  // raw → "raws" reads weird; map to "documents" so Cloudinary search is intuitive.
  const folderSuffix = resourceType === 'raw' ? 'documents' : `${resourceType}s`;
  const ownerPrefix = req.user?._id
    ? `phygital8thwall/${req.user._id}`
    : 'phygital8thwall/guest';
  const folder = `${ownerPrefix}/${folderSuffix}`;
  const payload = generateUploadSignature({
    resourceType,
    folder,
    tags: isDraftUpload ? [DRAFT_ASSET_TAG] : [],
  });

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
  const {
    campaignName,
    destinationUrl,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug: requestedRedirectSlug,
  } = req.body;

  if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
    throw new AppError(
      `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
      413
    );
  }

  let redirectSlug = requestedRedirectSlug || null;
  if (redirectSlug) {
    const exists = await Campaign.exists({ redirectSlug });
    if (exists) {
      throw new AppError('Generated QR slug expired. Please retry once.', 409);
    }
  } else {
    redirectSlug = await generateUniqueSlug();
  }

  const { ownerHandle, hubSlug } = await ensureOwnerHubFields(req.user._id, campaignName.trim());

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'single-link-qr',
    campaignName: campaignName.trim(),
    destinationUrl, // already normalized + SSRF-checked by Zod transform
    qrDesign: qrDesign || null,
    redirectSlug,
    ownerHandle,
    hubSlug,
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
  const {
    campaignName,
    linkItems,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug: requestedRedirectSlug,
  } = req.body;

  if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
    throw new AppError(
      `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
      413
    );
  }

  const persistedItems = await persistLinkItemsFromBody(linkItems);
  let redirectSlug = requestedRedirectSlug || null;
  if (redirectSlug) {
    const exists = await Campaign.exists({ redirectSlug });
    if (exists) throw new AppError('Generated QR slug expired. Please retry once.', 409);
  } else {
    redirectSlug = await generateUniqueSlug();
  }

  const { ownerHandle, hubSlug } = await ensureOwnerHubFields(req.user._id, campaignName.trim());

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'multiple-links-qr',
    campaignName: campaignName.trim(),
    linkItems: persistedItems,
    qrDesign: qrDesign || null,
    redirectSlug,
    ownerHandle,
    hubSlug,
    preciseGeoAnalytics: !!preciseGeoAnalytics,
    status: 'active',
  });

  return created(res, { campaign }, 'Multiple Links QR campaign created successfully');
};

/* ──────────────────────────────────────────────────────────────────
   links-doc-video-qr — multi-asset hub helpers
   - persistVideoItemsFromBody: assign per-row ids on create
   - persistDocItemsFromBody:   assign per-row ids on create
   - mergeVideoItemsForUpdate / mergeDocItemsForUpdate: preserve ids on
     PATCH so analytics totals stay aligned with existing rows
   ────────────────────────────────────────────────────────────────── */

const trimOrNull = (v) => {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : null;
};

const persistVideoItemsFromBody = async (videoItems, campaignSource) => {
  if (!Array.isArray(videoItems) || videoItems.length === 0) return undefined;
  const { nanoid } = await import('nanoid');
  return videoItems.map((vi) => {
    const isUpload = (vi.source || campaignSource) === 'upload';
    return {
      videoId: nanoid(12),
      label: vi.label.trim(),
      source: isUpload ? 'upload' : 'link',
      url: isUpload ? trimOrNull(vi.url) : null,
      publicId: isUpload ? trimOrNull(vi.publicId) : null,
      externalVideoUrl: isUpload ? null : trimOrNull(vi.externalVideoUrl),
      thumbnailUrl: trimOrNull(vi.thumbnailUrl),
    };
  });
};

const persistDocItemsFromBody = async (docItems) => {
  if (!Array.isArray(docItems) || docItems.length === 0) return undefined;
  const { nanoid } = await import('nanoid');
  return docItems.map((di) => ({
    docId: nanoid(12),
    label: di.label.trim(),
    url: di.url,
    publicId: trimOrNull(di.publicId),
    mimeType: trimOrNull(di.mimeType),
    bytes: typeof di.bytes === 'number' ? di.bytes : 0,
    resourceType: di.resourceType === 'image' ? 'image' : 'raw',
    addedAt: new Date(),
  }));
};

const mergeVideoItemsForUpdate = async (existing, incoming, campaignSource) => {
  const { nanoid } = await import('nanoid');
  const existingById = new Map((existing || []).map((it) => [it.videoId, it]));
  const assigned = new Set();
  return incoming.map((vi) => {
    const isUpload = (vi.source || campaignSource) === 'upload';
    let videoId = null;
    const claimed = trimOrNull(vi.videoId);
    if (claimed && existingById.has(claimed) && !assigned.has(claimed)) {
      videoId = claimed;
    } else {
      videoId = nanoid(12);
      while (assigned.has(videoId) || existingById.has(videoId)) videoId = nanoid(12);
    }
    assigned.add(videoId);
    return {
      videoId,
      label: vi.label.trim(),
      source: isUpload ? 'upload' : 'link',
      url: isUpload ? trimOrNull(vi.url) : null,
      publicId: isUpload ? trimOrNull(vi.publicId) : null,
      externalVideoUrl: isUpload ? null : trimOrNull(vi.externalVideoUrl),
      thumbnailUrl: trimOrNull(vi.thumbnailUrl),
    };
  });
};

const mergeDocItemsForUpdate = async (existing, incoming) => {
  const { nanoid } = await import('nanoid');
  const existingById = new Map((existing || []).map((it) => [it.docId, it]));
  const assigned = new Set();
  return incoming.map((di) => {
    let docId = null;
    const claimed = trimOrNull(di.docId);
    if (claimed && existingById.has(claimed) && !assigned.has(claimed)) {
      docId = claimed;
    } else {
      docId = nanoid(12);
      while (assigned.has(docId) || existingById.has(docId)) docId = nanoid(12);
    }
    assigned.add(docId);
    const fallback = existingById.get(docId);
    return {
      docId,
      label: di.label.trim(),
      url: di.url,
      publicId: trimOrNull(di.publicId) || fallback?.publicId || null,
      mimeType: trimOrNull(di.mimeType) || fallback?.mimeType || null,
      bytes: typeof di.bytes === 'number' ? di.bytes : (fallback?.bytes || 0),
      resourceType: di.resourceType === 'image' ? 'image' : 'raw',
      addedAt: fallback?.addedAt || new Date(),
    };
  });
};

const pruneAssetTotals = (totals, validIds) => {
  const next = {};
  if (totals && typeof totals === 'object' && !Array.isArray(totals)) {
    for (const id of validIds) {
      if (Object.prototype.hasOwnProperty.call(totals, id)) {
        next[id] = totals[id];
      }
    }
  }
  return next;
};

/**
 * Best-effort Cloudinary cleanup for assets removed during a PATCH.
 * Returns immediately and never throws — campaigns must not get stuck on a
 * Cloudinary outage. We return the diff so the caller can also prune the
 * matching `analytics.*Totals` keys.
 */
const diffAndCleanupRemovedAssets = (oldList, newList, idKey, resourceTypeFor) => {
  const keptIds = new Set((newList || []).map((x) => x[idKey]));
  const removed = (oldList || []).filter((x) => !keptIds.has(x[idKey]));
  removed.forEach((row) => {
    if (!row.publicId) return;
    deleteCloudinaryAsset(row.publicId, resourceTypeFor(row)).catch(() => {});
  });
  return removed;
};

/* ─────────────────────────────────────────
   POST /api/campaigns/links-doc-video
   Multi-asset hub: up to 5 videos and 5 documents on top of a link list.
   At least 1 link AND at least 1 of {video, doc} (validated upstream).
   ───────────────────────────────────────── */
const createLinksDocVideoCampaign = async (req, res) => {
  const {
    campaignName,
    videoSource,
    videoItems,
    docItems,
    linkItems,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug: requestedRedirectSlug,
  } = req.body;

  if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
    throw new AppError(
      `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
      413
    );
  }

  const [persistedLinks, persistedVideos, persistedDocs] = await Promise.all([
    persistLinkItemsFromBody(linkItems),
    persistVideoItemsFromBody(videoItems, videoSource),
    persistDocItemsFromBody(docItems),
  ]);
  let redirectSlug = requestedRedirectSlug || null;
  if (redirectSlug) {
    const exists = await Campaign.exists({ redirectSlug });
    if (exists) throw new AppError('Generated QR slug expired. Please retry once.', 409);
  } else {
    redirectSlug = await generateUniqueSlug();
  }

  const { ownerHandle, hubSlug } = await ensureOwnerHubFields(req.user._id, campaignName.trim());

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'links-doc-video-qr',
    campaignName: campaignName.trim(),
    videoSource,
    videoItems: persistedVideos,
    docItems: persistedDocs,
    linkItems: persistedLinks,
    qrDesign: qrDesign || null,
    redirectSlug,
    ownerHandle,
    hubSlug,
    preciseGeoAnalytics: !!preciseGeoAnalytics,
    status: 'active',
  });

  const uploadVideoPublicIds = (persistedVideos || [])
    .filter((vi) => vi.source === 'upload' && vi.publicId)
    .map((vi) => vi.publicId);
  const uploadImageDocPublicIds = (persistedDocs || [])
    .filter((di) => di.resourceType === 'image' && di.publicId)
    .map((di) => di.publicId);
  const uploadRawDocPublicIds = (persistedDocs || [])
    .filter((di) => di.resourceType !== 'image' && di.publicId)
    .map((di) => di.publicId);

  if (uploadVideoPublicIds.length || uploadImageDocPublicIds.length || uploadRawDocPublicIds.length) {
    claimUploadedDraftAssets({
      video: uploadVideoPublicIds,
      image: uploadImageDocPublicIds,
      raw: uploadRawDocPublicIds,
    }).catch(() => {});
  }

  return created(res, { campaign }, 'Links + Doc + Video QR campaign created successfully');
};

/* ─────────────────────────────────────────────────────────────────────────────
   digital-business-card — personalized identity card hub
   Creation, slug allocation, and per-section id assignment.
   ─────────────────────────────────────────────────────────────────────────── */

const DEFAULT_CARD_DESIGN = Object.freeze({
  template: 'professional',
  colors: { primary: '#3b82f6', secondary: '#1d4ed8', background: '#030712' },
  font: 'Inter',
  layout: 'left-aligned',
  corners: 'rounded',
  spacing: 'normal',
});

const DEFAULT_CARD_PRINT_SETTINGS = Object.freeze({
  cardSize: DEFAULT_CARD_SIZE,
  theme: 'white',
  qrPosition: 'bottom-right',
  qrPlacement: 'both',
  includeQr: true,
  displayFields: ['name', 'jobTitle', 'company', 'phone', 'email', 'website'],
  profileZoom: 1.0,
  profileCropX: 50,
  profileCropY: 50,
});

/** Slugify a free-text string into kebab-case (3-60 chars). */
const slugifyForCard = (raw) => {
  const base = String(raw || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  if (base.length >= 3) return base;
  return null;
};

/** Pick a unique cardSlug. Adds a short nanoid suffix on collision. */
const generateUniqueCardSlug = async (preferred, fallbackName) => {
  const { nanoid } = await import('nanoid');
  const candidates = [];
  if (preferred) candidates.push(preferred);
  const slugified = slugifyForCard(fallbackName);
  if (slugified) candidates.push(slugified);

  for (const candidate of candidates) {
    const exists = await Campaign.exists({ cardSlug: candidate });
    if (!exists) return candidate;
    // Try with a short nanoid suffix to disambiguate.
    for (let attempt = 0; attempt < 3; attempt++) {
      const suffix = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'card';
      const next = `${candidate}-${suffix}`.slice(0, 60);
      const taken = await Campaign.exists({ cardSlug: next });
      if (!taken) return next;
    }
  }
  // Final fallback: pure nanoid
  return `card-${nanoid(10).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}`;
};

const ensureSectionIds = async (sections) => {
  if (!Array.isArray(sections) || sections.length === 0) return [];
  const { nanoid } = await import('nanoid');
  return sections.map((sec) => ({
    ...sec,
    id: sec.id || nanoid(10),
  }));
};

/**
 * Hash the user-visible inputs to the print PNG so unchanged renders can
 * be served from the Cloudinary cache without launching Chromium again.
 * Order-independent: we serialize with sorted keys so trivial reordering
 * doesn't bust the cache.
 */
const stableStringify = (val) => {
  if (val === null || typeof val !== 'object') return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(stableStringify).join(',')}]`;
  const keys = Object.keys(val).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(val[k])}`).join(',')}}`;
};

const buildCardRenderHash = (campaign, printSettingsOverride = {}, face = 'front') => {
  const settings = { ...DEFAULT_CARD_PRINT_SETTINGS, ...(campaign.cardPrintSettings || {}), ...printSettingsOverride };
  const payload = {
    content: campaign.cardContent || {},
    design: campaign.cardDesign || {},
    print: settings,
    slug: campaign.cardSlug || campaign.redirectSlug || '',
    face,
  };
  return crypto.createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 32);
};

/* ─────────────────────────────────────────
   POST /api/campaigns/digital-business-card
   Creates a Personalized Identity card. Mirrors the dedicated-route pattern
   used by other hub types and additionally allocates a friendly `cardSlug`
   on top of the immutable 8-char `redirectSlug` (used for QR encoding).
   ───────────────────────────────────────── */
const createDigitalBusinessCardCampaign = async (req, res) => {
  const {
    campaignName,
    cardSlug,
    visibility,
    cardContent,
    cardDesign,
    cardPrintSettings,
    qrDesign,
    preciseGeoAnalytics,
  } = req.body;

  if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
    throw new AppError(
      `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
      413
    );
  }

  const sections = await ensureSectionIds(cardContent?.sections);
  const sealedContent = { ...cardContent, sections };

  const [redirectSlug, allocatedCardSlug] = await Promise.all([
    generateUniqueSlug(),
    generateUniqueCardSlug(cardSlug, cardContent?.fullName || campaignName),
  ]);

  const { ownerHandle, hubSlug } = await ensureOwnerHubFields(req.user._id, campaignName.trim());

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'digital-business-card',
    campaignName: campaignName.trim(),
    cardSlug: allocatedCardSlug,
    visibility: visibility || 'public',
    cardContent: sealedContent,
    cardDesign: { ...DEFAULT_CARD_DESIGN, ...(cardDesign || {}) },
    cardPrintSettings: { ...DEFAULT_CARD_PRINT_SETTINGS, ...(cardPrintSettings || {}) },
    qrDesign: qrDesign || null,
    redirectSlug,
    ownerHandle,
    hubSlug,
    preciseGeoAnalytics: !!preciseGeoAnalytics,
    status: 'active',
  });

  return created(res, { campaign }, 'Digital Business Card created successfully');
};

/* ─────────────────────────────────────────
   GET /api/campaigns/check-card-slug?slug=&excludeId=
   Used by the wizard's debounced availability check.
   ───────────────────────────────────────── */
const checkCardSlugAvailability = async (req, res) => {
  const slug = String(req.query.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/.test(slug)) {
    return success(res, { available: false, reason: 'invalid' });
  }
  const filter = { cardSlug: slug, isDeleted: { $ne: true } };
  if (req.query.excludeId) filter._id = { $ne: req.query.excludeId };
  const taken = await Campaign.exists(filter);
  return success(res, { available: !taken });
};

/* ─────────────────────────────────────────
   POST /api/campaigns/:id/card-image
   Returns a high-resolution PNG of the card at the requested size. Tries
   the Cloudinary cache first; otherwise renders via Puppeteer (or enqueues
   a render job when REDIS_URL is set). Always emits a `print-download`
   action telemetry row regardless of cache hit.
   ───────────────────────────────────────── */
const renderCampaignCardImage = async (req, res) => {
  const campaign = await Campaign.findOne(
    { _id: req.params.id, userId: req.user._id, isDeleted: { $ne: true } },
    'campaignType cardSlug redirectSlug cardContent cardDesign cardPrintSettings'
  ).lean();
  if (!campaign) throw new AppError('Campaign not found', 404);
  if (campaign.campaignType !== 'digital-business-card') {
    throw new AppError('This endpoint is only available for digital business cards', 400);
  }

  const sizeOverride = String(req.query.size || '').trim();
  const size = CARD_SIZE_IDS.includes(sizeOverride)
    ? sizeOverride
    : (campaign.cardPrintSettings?.cardSize || DEFAULT_CARD_SIZE);

  // Render both faces in parallel. Each face has its own deterministic
  // hash so cache hits are independent — re-rendering the front does not
  // bust the back, and vice versa.
  const renderFace = (face) => renderCardPng({
    campaignId: String(campaign._id),
    userId: String(req.user._id),
    // Printed QR must always encode immutable redirectSlug; cardSlug is only
    // for friendly public URLs and can be renamed later.
    cardSlug: campaign.cardSlug || campaign.redirectSlug,
    size,
    face,
    renderHash: buildCardRenderHash(campaign, { cardSize: size }, face),
  });

  let front;
  let back;
  try {
    [front, back] = await Promise.all([renderFace('front'), renderFace('back')]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('renderCampaignCardImage failed', {
      campaignId: String(campaign._id),
      userId: String(req.user._id),
      size,
      cardSlug: campaign.cardSlug || null,
      redirectSlug: campaign.redirectSlug || null,
      error: message,
      stack: err instanceof Error ? err.stack : null,
    });
    throw new AppError(message || 'Card render failed', 500);
  }

  // The aggregate status is "ready" only when both faces are ready in this
  // round-trip. If either is queued, the client polls each jobId.
  const status = front.status === 'ready' && back.status === 'ready' ? 'ready' : 'pending';

  // Telemetry: record a print download (best-effort; never block the response).
  LinkClickEvent.create({
    campaignId: campaign._id,
    userId: req.user._id,
    linkId: 'print-download',
    kind: 'link',
    visitorHash: null,
    clickedAt: new Date(),
  }).catch(() => {});
  Campaign.updateOne(
    { _id: campaign._id },
    { $inc: { [`analytics.cardActionTotals.print-download`]: 1 } }
  ).catch(() => {});

  return success(res, { status, front, back }, 'Card image ready');
};

/* ─────────────────────────────────────────
   POST /api/campaigns/links-video
   Hub page with a hero video (uploaded to Cloudinary OR pasted public URL)
   above a curated link list. Same redirect/hub plumbing as multiple-links-qr.
   ───────────────────────────────────────── */
const createLinksVideoCampaign = async (req, res) => {
  const {
    campaignName,
    videoSource,
    videoUrl,
    videoPublicId,
    externalVideoUrl,
    thumbnailUrl,
    linkItems,
    qrDesign,
    preciseGeoAnalytics,
    redirectSlug: requestedRedirectSlug,
  } = req.body;

  if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
    throw new AppError(
      `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
      413
    );
  }

  const persistedItems = await persistLinkItemsFromBody(linkItems);
  let redirectSlug = requestedRedirectSlug || null;
  if (redirectSlug) {
    const exists = await Campaign.exists({ redirectSlug });
    if (exists) throw new AppError('Generated QR slug expired. Please retry once.', 409);
  } else {
    redirectSlug = await generateUniqueSlug();
  }

  const { ownerHandle, hubSlug } = await ensureOwnerHubFields(req.user._id, campaignName.trim());

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignType: 'links-video-qr',
    campaignName: campaignName.trim(),
    videoSource,
    // Only the field that matches the source is persisted; the other stays null.
    videoUrl: videoSource === 'upload' ? videoUrl : null,
    videoPublicId: videoSource === 'upload' ? (videoPublicId || null) : null,
    externalVideoUrl: videoSource === 'link' ? externalVideoUrl : null,
    thumbnailUrl: thumbnailUrl || null,
    linkItems: persistedItems,
    qrDesign: qrDesign || null,
    redirectSlug,
    ownerHandle,
    hubSlug,
    preciseGeoAnalytics: !!preciseGeoAnalytics,
    status: 'active',
  });

  if (videoSource === 'upload' && videoPublicId) {
    claimUploadedDraftAssets({ video: [videoPublicId] }).catch(() => {});
  }

  return created(res, { campaign }, 'Links + Video QR campaign created successfully');
};

/* ─────────────────────────────────────────
   GET /api/campaigns
   ───────────────────────────────────────── */
const getCampaigns = async (req, res) => {
  const { status, campaignType, page = 1, limit = 12 } = req.query;

  // Soft-delete filter applied to every dashboard query.
  const filter = { userId: req.user._id, isDeleted: { $ne: true } };
  if (status && ['draft', 'active', 'paused'].includes(status)) {
    filter.status = status;
  }
  if (
    campaignType
    && [
      'ar-card',
      'single-link-qr',
      'multiple-links-qr',
      'links-video-qr',
      'links-doc-video-qr',
      'digital-business-card',
    ].includes(campaignType)
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
    isDeleted: { $ne: true },
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
    { _id: req.params.id, userId: req.user._id, isDeleted: { $ne: true } },
    [
      'campaignType',
      'redirectSlug',
      'cardSlug',
      'cardContent',
      'cardDesign',
      'cardPrintSettings',
      'status',
      'linkItems',
      'videoSource',
      'videoItems',
      'docItems',
      'analytics.linkClickTotals',
      'analytics.docOpenTotals',
      'analytics.videoPlayTotals',
    ].join(' ')
  ).lean();
  if (!existing) throw new AppError('Campaign not found', 404);

  const {
    campaignName,
    status,
    destinationUrl,
    qrDesign,
    preciseGeoAnalytics,
    linkItems,
    videoSource,
    videoUrl,
    videoPublicId,
    externalVideoUrl,
    thumbnailUrl,
    videoItems,
    docItems,
    cardSlug,
    visibility,
    cardContent,
    cardDesign,
    cardPrintSettings,
  } = req.body;
  const updates = {};
  let previousCardSlug = null;

  if (campaignName !== undefined) updates.campaignName = campaignName;
  if (status !== undefined) updates.status = status;

  const applyQrDesign = () => {
    if (qrDesign === undefined) return;
    if (qrDesign && JSON.stringify(qrDesign).length > MAX_QR_DESIGN_BYTES) {
      throw new AppError(
        `qrDesign payload exceeds ${MAX_QR_DESIGN_BYTES} bytes`,
        413
      );
    }
    updates.qrDesign = qrDesign;
  };

  const applyLinkItemsMerge = async () => {
    if (linkItems === undefined) return;
    const merged = await mergeLinkItemsForUpdate(existing.linkItems, linkItems);
    updates.linkItems = merged;
    updates['analytics.linkClickTotals'] = pruneLinkClickTotals(
      existing.analytics?.linkClickTotals,
      merged.map((m) => m.linkId)
    );
  };

  // Type-gated fields — silently ignored on the wrong type to keep the contract
  // forgiving (the frontend re-uses one PATCH for all campaign types).
  if (existing.campaignType === 'single-link-qr') {
    if (destinationUrl !== undefined) updates.destinationUrl = destinationUrl;
    if (preciseGeoAnalytics !== undefined) updates.preciseGeoAnalytics = !!preciseGeoAnalytics;
    applyQrDesign();
  }

  if (existing.campaignType === 'multiple-links-qr') {
    if (preciseGeoAnalytics !== undefined) updates.preciseGeoAnalytics = !!preciseGeoAnalytics;
    applyQrDesign();
    await applyLinkItemsMerge();
  }

  if (existing.campaignType === 'links-video-qr') {
    if (preciseGeoAnalytics !== undefined) updates.preciseGeoAnalytics = !!preciseGeoAnalytics;
    applyQrDesign();
    await applyLinkItemsMerge();
    if (thumbnailUrl !== undefined) updates.thumbnailUrl = thumbnailUrl;

    // Video source can be swapped post-create; clear the unused side so we
    // never serve stale data from the public meta endpoint.
    const nextSource =
      videoSource !== undefined ? videoSource : existing.videoSource;
    if (videoSource !== undefined) updates.videoSource = videoSource;

    if (nextSource === 'upload') {
      if (videoUrl !== undefined) updates.videoUrl = videoUrl;
      if (videoPublicId !== undefined) updates.videoPublicId = videoPublicId;
      if (videoSource === 'upload') {
        updates.externalVideoUrl = null;
      }
    } else if (nextSource === 'link') {
      if (externalVideoUrl !== undefined) updates.externalVideoUrl = externalVideoUrl;
      if (videoSource === 'link') {
        updates.videoUrl = null;
        updates.videoPublicId = null;
      }
    }
  }

  if (existing.campaignType === 'links-doc-video-qr') {
    if (preciseGeoAnalytics !== undefined) updates.preciseGeoAnalytics = !!preciseGeoAnalytics;
    applyQrDesign();
    await applyLinkItemsMerge();

    const nextSource =
      videoSource !== undefined ? videoSource : existing.videoSource;
    if (videoSource !== undefined) updates.videoSource = videoSource;

    if (videoItems !== undefined) {
      // Enforce campaign-wide source on PATCH too — easier to keep aggregations
      // sane than to support mixed modes per row.
      const merged = await mergeVideoItemsForUpdate(existing.videoItems, videoItems, nextSource);
      const mismatched = merged.find((m) => m.source !== nextSource);
      if (mismatched) {
        throw new AppError(
          `videoItems must all match videoSource ("${nextSource}")`,
          400
        );
      }
      diffAndCleanupRemovedAssets(existing.videoItems, merged, 'videoId', () => 'video');
      updates.videoItems = merged;
      updates['analytics.videoPlayTotals'] = pruneAssetTotals(
        existing.analytics?.videoPlayTotals,
        merged.map((m) => m.videoId)
      );
    }

    if (docItems !== undefined) {
      const merged = await mergeDocItemsForUpdate(existing.docItems, docItems);
      diffAndCleanupRemovedAssets(
        existing.docItems,
        merged,
        'docId',
        (row) => (row.resourceType === 'image' ? 'image' : 'raw')
      );
      updates.docItems = merged;
      updates['analytics.docOpenTotals'] = pruneAssetTotals(
        existing.analytics?.docOpenTotals,
        merged.map((m) => m.docId)
      );
    }
  }

  if (existing.campaignType === 'digital-business-card') {
    if (visibility !== undefined) updates.visibility = visibility;
    applyQrDesign();

    if (cardSlug !== undefined && cardSlug !== existing.cardSlug) {
      // Verify uniqueness — a kebab-case rename must not collide with another
      // user's card. We accept the new slug as-is; Zod already validated
      // shape and length.
      const taken = await Campaign.exists({
        cardSlug,
        _id: { $ne: existing._id },
        isDeleted: { $ne: true },
      });
      if (taken) {
        throw new AppError('That custom URL is already taken', 409);
      }
      previousCardSlug = existing.cardSlug;
      updates.cardSlug = cardSlug;
    }

    if (cardContent !== undefined) {
      const sections = await ensureSectionIds(cardContent.sections);
      updates.cardContent = { ...cardContent, sections };

      // Cloudinary cleanup for swapped profile/banner images.
      const oldProfileId = existing.cardContent?.profileImagePublicId;
      const newProfileId = cardContent?.profileImagePublicId;
      if (oldProfileId && oldProfileId !== newProfileId) {
        deleteCloudinaryAsset(oldProfileId, 'image').catch(() => {});
      }
      const oldBannerId = existing.cardContent?.bannerImagePublicId;
      const newBannerId = cardContent?.bannerImagePublicId;
      if (oldBannerId && oldBannerId !== newBannerId) {
        deleteCloudinaryAsset(oldBannerId, 'image').catch(() => {});
      }
    }
    if (cardDesign !== undefined) {
      updates.cardDesign = { ...DEFAULT_CARD_DESIGN, ...(existing.cardDesign || {}), ...cardDesign };
    }
    if (cardPrintSettings !== undefined) {
      updates.cardPrintSettings = {
        ...DEFAULT_CARD_PRINT_SETTINGS,
        ...(existing.cardPrintSettings || {}),
        ...cardPrintSettings,
      };
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
      || existing.campaignType === 'multiple-links-qr'
      || existing.campaignType === 'links-video-qr'
      || existing.campaignType === 'links-doc-video-qr')
    && existing.redirectSlug
  ) {
    redirectCache.evict(existing.redirectSlug).catch(() => {});
    evictDynamicQrMetaForCampaign(existing);
  }

  if (existing.campaignType === 'digital-business-card') {
    if (existing.redirectSlug) redirectCache.evict(existing.redirectSlug).catch(() => {});
    if (existing.cardSlug) cardMetaCache.evict(existing.cardSlug).catch(() => {});
    if (previousCardSlug) cardMetaCache.evict(previousCardSlug).catch(() => {});
  }

  return success(res, { campaign }, 'Campaign updated');
};

/* ─────────────────────────────────────────
   DELETE /api/campaigns/:id
   Soft delete — flips `isDeleted=true` and clears slug caches. Hard delete
   (Cloudinary cleanup + analytics row removal) runs in the daily purge cron
   after a 7-day grace window so users can restore accidental deletions.
   `?hard=1` forces an immediate hard-delete (admin/test path).
   ───────────────────────────────────────── */
const deleteCampaign = async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: { $ne: true },
  });
  if (!campaign) throw new AppError('Campaign not found', 404);

  const hardDelete = req.query.hard === '1' || req.query.hard === 'true';

  if (campaign.redirectSlug) {
    redirectCache.evict(campaign.redirectSlug).catch(() => {});
    evictDynamicQrMetaForCampaign(campaign);
  }
  if (campaign.cardSlug) cardMetaCache.evict(campaign.cardSlug).catch(() => {});

  if (!hardDelete) {
    campaign.isDeleted = true;
    campaign.deletedAt = new Date();
    campaign.status = 'paused';
    await campaign.save({ validateModifiedOnly: true });
    return success(res, { soft: true }, 'Campaign deleted');
  }

  // Cloudinary cleanup for assets we own. Everything is best-effort and
  // intentionally non-fatal so user deletion never gets stuck on third-party IO.
  const cloudinaryDeletes = [];
  if (campaign.targetImagePublicId) {
    cloudinaryDeletes.push(deleteCloudinaryAsset(campaign.targetImagePublicId, 'image'));
  }
  if (campaign.videoPublicId) {
    cloudinaryDeletes.push(deleteCloudinaryAsset(campaign.videoPublicId, 'video'));
  }
  if (campaign.qrPublicId) {
    cloudinaryDeletes.push(deleteCloudinaryAsset(campaign.qrPublicId, 'image'));
  }
  // links-doc-video-qr: per-asset Cloudinary cleanup
  for (const vi of campaign.videoItems || []) {
    if (vi.source === 'upload' && vi.publicId) {
      cloudinaryDeletes.push(deleteCloudinaryAsset(vi.publicId, 'video'));
    }
  }
  for (const di of campaign.docItems || []) {
    if (di.publicId) {
      cloudinaryDeletes.push(
        deleteCloudinaryAsset(di.publicId, di.resourceType === 'image' ? 'image' : 'raw')
      );
    }
  }
  // digital-business-card profile / banner / gallery cleanup
  if (campaign.campaignType === 'digital-business-card') {
    if (campaign.cardContent?.profileImagePublicId) {
      cloudinaryDeletes.push(deleteCloudinaryAsset(campaign.cardContent.profileImagePublicId, 'image'));
    }
    if (campaign.cardContent?.bannerImagePublicId) {
      cloudinaryDeletes.push(deleteCloudinaryAsset(campaign.cardContent.bannerImagePublicId, 'image'));
    }
    for (const sec of campaign.cardContent?.sections || []) {
      if (sec.type === 'imageGallery' && Array.isArray(sec.images)) {
        for (const img of sec.images) {
          if (img.publicId) cloudinaryDeletes.push(deleteCloudinaryAsset(img.publicId, 'image'));
        }
      }
      if (sec.type === 'video' && sec.source === 'upload' && sec.publicId) {
        cloudinaryDeletes.push(deleteCloudinaryAsset(sec.publicId, 'video'));
      }
    }
  }
  if (cloudinaryDeletes.length) {
    const results = await Promise.allSettled(cloudinaryDeletes);
    results.forEach((r) => {
      if (r.status === 'rejected') {
        logger.warn('Cloudinary cleanup failed during campaign delete', {
          campaignId: String(campaign._id),
          error: r.reason?.message || String(r.reason),
        });
      }
    });
  }

  // Delete all dependent analytics rows so no orphaned records remain.
  await Promise.all([
    ScanEvent.deleteMany({ campaignId: campaign._id }),
    LinkClickEvent.deleteMany({ campaignId: campaign._id }),
    VideoPlayEvent.deleteMany({ campaignId: campaign._id }),
  ]);

  await campaign.deleteOne();

  return success(res, { hard: true }, 'Campaign permanently deleted');
};

/* ─────────────────────────────────────────
   POST /api/campaigns/:id/duplicate
   ───────────────────────────────────────── */
const duplicateCampaign = async (req, res) => {
  const original = await Campaign.findOne({
    _id: req.params.id,
    userId: req.user._id,
    isDeleted: { $ne: true },
  }).lean();

  if (!original) throw new AppError('Campaign not found', 404);

  if (original.campaignType === 'single-link-qr') {
    const redirectSlug = await generateUniqueSlug();
    const newName = `Copy of ${original.campaignName}`.trim();
    const { ownerHandle, hubSlug } = await ensureOwnerHubFields(original.userId, newName);
    const copy = await Campaign.create({
      userId: original.userId,
      campaignType: 'single-link-qr',
      campaignName: newName,
      destinationUrl: original.destinationUrl,
      qrDesign: original.qrDesign,
      redirectSlug,
      ownerHandle,
      hubSlug,
      preciseGeoAnalytics: !!original.preciseGeoAnalytics,
      status: 'active',
    });
    return created(res, { campaign: copy }, 'Campaign duplicated successfully');
  }

  if (original.campaignType === 'multiple-links-qr') {
    const { nanoid } = await import('nanoid');
    const redirectSlug = await generateUniqueSlug();
    const newName = `Copy of ${original.campaignName}`.trim();
    const { ownerHandle, hubSlug } = await ensureOwnerHubFields(original.userId, newName);
    const items = (original.linkItems || []).map((it) => ({
      linkId: nanoid(12),
      kind: it.kind,
      label: it.label,
      value: it.value,
    }));
    const copy = await Campaign.create({
      userId: original.userId,
      campaignType: 'multiple-links-qr',
      campaignName: newName,
      linkItems: items,
      qrDesign: original.qrDesign,
      redirectSlug,
      ownerHandle,
      hubSlug,
      preciseGeoAnalytics: !!original.preciseGeoAnalytics,
      status: 'active',
    });
    return created(res, { campaign: copy }, 'Campaign duplicated successfully');
  }

  if (original.campaignType === 'links-video-qr') {
    const { nanoid } = await import('nanoid');
    const redirectSlug = await generateUniqueSlug();
    const newName = `Copy of ${original.campaignName}`.trim();
    const { ownerHandle, hubSlug } = await ensureOwnerHubFields(original.userId, newName);
    const items = (original.linkItems || []).map((it) => ({
      linkId: nanoid(12),
      kind: it.kind,
      label: it.label,
      value: it.value,
    }));
    const copy = await Campaign.create({
      userId: original.userId,
      campaignType: 'links-video-qr',
      campaignName: newName,
      videoSource: original.videoSource,
      videoUrl: original.videoUrl,
      videoPublicId: original.videoPublicId,
      externalVideoUrl: original.externalVideoUrl,
      thumbnailUrl: original.thumbnailUrl,
      linkItems: items,
      qrDesign: original.qrDesign,
      redirectSlug,
      ownerHandle,
      hubSlug,
      preciseGeoAnalytics: !!original.preciseGeoAnalytics,
      status: 'active',
    });
    return created(res, { campaign: copy }, 'Campaign duplicated successfully');
  }

  if (original.campaignType === 'digital-business-card') {
    const newName = `Copy of ${original.campaignName}`;
    const [redirectSlug, allocatedCardSlug] = await Promise.all([
      generateUniqueSlug(),
      generateUniqueCardSlug(null, newName),
    ]);
    const { ownerHandle, hubSlug } = await ensureOwnerHubFields(original.userId, newName.trim());
    const sections = await ensureSectionIds(original.cardContent?.sections);
    const copy = await Campaign.create({
      userId: original.userId,
      campaignType: 'digital-business-card',
      campaignName: newName,
      cardSlug: allocatedCardSlug,
      visibility: original.visibility || 'public',
      cardContent: { ...(original.cardContent || {}), sections },
      cardDesign: original.cardDesign,
      cardPrintSettings: original.cardPrintSettings,
      qrDesign: original.qrDesign,
      redirectSlug,
      ownerHandle,
      hubSlug,
      preciseGeoAnalytics: !!original.preciseGeoAnalytics,
      status: 'active',
    });
    return created(res, { campaign: copy }, 'Campaign duplicated successfully');
  }

  if (original.campaignType === 'links-doc-video-qr') {
    const { nanoid } = await import('nanoid');
    const redirectSlug = await generateUniqueSlug();
    const newName = `Copy of ${original.campaignName}`.trim();
    const { ownerHandle, hubSlug } = await ensureOwnerHubFields(original.userId, newName);
    const links = (original.linkItems || []).map((it) => ({
      linkId: nanoid(12),
      kind: it.kind,
      label: it.label,
      value: it.value,
    }));
    // Asset rows keep their Cloudinary URLs / publicIds — duplicating shares
    // storage; deleting the duplicate later won't try to remove the same
    // publicId twice because the cleanup is best-effort and idempotent.
    const videos = (original.videoItems || []).map((it) => ({
      videoId: nanoid(12),
      label: it.label,
      source: it.source,
      url: it.url || null,
      publicId: it.publicId || null,
      externalVideoUrl: it.externalVideoUrl || null,
      thumbnailUrl: it.thumbnailUrl || null,
    }));
    const docs = (original.docItems || []).map((it) => ({
      docId: nanoid(12),
      label: it.label,
      url: it.url,
      publicId: it.publicId || null,
      mimeType: it.mimeType || null,
      bytes: it.bytes || 0,
      resourceType: it.resourceType || 'raw',
      addedAt: new Date(),
    }));
    const copy = await Campaign.create({
      userId: original.userId,
      campaignType: 'links-doc-video-qr',
      campaignName: newName,
      videoSource: original.videoSource,
      videoItems: videos.length ? videos : undefined,
      docItems: docs.length ? docs : undefined,
      linkItems: links,
      qrDesign: original.qrDesign,
      redirectSlug,
      ownerHandle,
      hubSlug,
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
    { _id: req.params.id, userId: req.user._id, isDeleted: { $ne: true } },
    'qrCodeUrl qrPublicId campaignName campaignType redirectSlug cardSlug qrDesign preciseGeoAnalytics ownerHandle hubSlug'
  ).lean();

  if (!campaign) throw new AppError('Campaign not found', 404);

  if (
    campaign.campaignType === 'single-link-qr'
    || campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr'
  ) {
    const apiBase = process.env.PUBLIC_REDIRECT_BASE
      || process.env.API_URL
      || `${req.protocol}://${req.get('host')}`;
    const apiRoot = apiBase.replace(/\/$/, '');
    const clientBase = (process.env.CLIENT_URL || '').replace(/\/$/, '');

    let redirectUrl;
    if (campaign.preciseGeoAnalytics && clientBase) {
      if (campaign.hubSlug && campaign.ownerHandle) {
        redirectUrl = `${clientBase}/open/${campaign.ownerHandle}/${campaign.hubSlug}`;
      } else {
        redirectUrl = `${clientBase}/open/${campaign.redirectSlug}`;
      }
    } else {
      redirectUrl = `${apiRoot}/r/${campaign.redirectSlug}`;
    }

    return success(res, {
      campaignType: campaign.campaignType,
      redirectUrl,
      redirectSlug: campaign.redirectSlug,
      ownerHandle: campaign.ownerHandle || null,
      hubSlug: campaign.hubSlug || null,
      qrDesign: campaign.qrDesign,
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      ready: true,
    });
  }

  if (campaign.campaignType === 'digital-business-card') {
    const apiBase = process.env.PUBLIC_REDIRECT_BASE
      || process.env.API_URL
      || `${req.protocol}://${req.get('host')}`;
    const apiRoot = apiBase.replace(/\/$/, '');
    const clientBase = (process.env.CLIENT_URL || '').replace(/\/$/, '');

    // QR encodes the API short URL (8-char redirectSlug); /r/:slug 302's to
    // the friendly /card/:cardSlug. The client UI also surfaces the friendly
    // public URL for sharing.
    const redirectUrl = `${apiRoot}/r/${campaign.redirectSlug}`;
    const publicUrl = clientBase && campaign.cardSlug
      ? `${clientBase}/card/${campaign.cardSlug}`
      : null;

    return success(res, {
      campaignType: campaign.campaignType,
      redirectUrl,
      redirectSlug: campaign.redirectSlug,
      cardSlug: campaign.cardSlug,
      publicUrl,
      qrDesign: campaign.qrDesign,
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
  createLinksVideoCampaign,
  createLinksDocVideoCampaign,
  createDigitalBusinessCardCampaign,
  checkCardSlugAvailability,
  renderCampaignCardImage,
  getCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaignQR,
};
