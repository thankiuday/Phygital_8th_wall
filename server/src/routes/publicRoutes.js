'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Campaign = require('../models/Campaign');
const ScanEvent = require('../models/ScanEvent');
const LinkClickEvent = require('../models/LinkClickEvent');
const VideoPlayEvent = require('../models/VideoPlayEvent');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');
const scanQueue = require('../utils/scanQueue');
const { getClientIpFromRequest, getCfIpCountry } = require('../utils/geoLookup');
const { validate } = require('../middleware/validate');
const {
  publicSingleLinkScanSchema,
  publicMultiLinkScanSchema,
  publicMultiLinkClickSchema,
  publicMultiLinkSessionSchema,
  publicMultiLinkVideoSchema,
  publicCardScanSchema,
  publicCardActionSchema,
  publicCardSessionSchema,
} = require('../validators/publicScanValidators');
const { toPublicLinkList } = require('../utils/linkItemResolver');
const { SLUG_RE } = require('../constants/singleLinkSlug');
const { dynamicQrMetaCache, cardMetaCache } = require('../utils/redirectCache');
const { toEmbedSrc, detectVideoHost } = require('../utils/videoEmbed');
const cardActionQueue = require('../utils/cardActionQueue');
const { cloudinaryTransform } = require('../utils/cloudinaryTransform');
const { getRenderJobStatus, verifyPrintToken } = require('../services/cardPrintService');
const logger = require('../config/logger');

/** Friendly user-facing card slug — kebab-case, 3-60 chars (mirrors validator). */
const CARD_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

/** Campaign types that funnel through the multi-link hub + analytics path. */
const HUB_CAMPAIGN_TYPES = [
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
];

/** Hub types that can ship hero/video assets and therefore accept video beacons. */
const VIDEO_CAPABLE_HUB_TYPES = ['links-video-qr', 'links-doc-video-qr'];

/* ── Generous rate limit — AR scans can come in bursts ──────────── */
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─────────────────────────────────────────
   GET /api/public/campaigns/:id
   No auth. Used by the AR engine and public AR landing page.
   Returns only the fields needed to render the AR experience.
   ───────────────────────────────────────── */
router.get('/campaigns/:id', publicLimiter, async (req, res) => {
  const campaign = await Campaign.findOne(
    { _id: req.params.id, status: 'active' },
    'campaignName targetImageUrl videoUrl thumbnailUrl status analytics'
  ).lean();

  if (!campaign) {
    throw new AppError('Campaign not found or is currently inactive', 404);
  }

  return success(res, { campaign });
});

/* ─────────────────────────────────────────
   POST /api/public/campaigns/:id/scan
   Records a scan event (called by the AR engine when target is detected).
   No auth — anyone scanning the card triggers this.
   ───────────────────────────────────────── */
router.post('/campaigns/:id/scan', publicLimiter, async (req, res) => {
  const campaign = await Campaign.findOne(
    { _id: req.params.id, status: 'active' },
    '_id userId analytics'
  );

  if (!campaign) {
    throw new AppError('Campaign not found', 404);
  }

  const { deviceType = 'unknown', browser = 'unknown', visitorHash } = req.body;

  // Create scan event
  await ScanEvent.create({
    campaignId: campaign._id,
    userId: campaign.userId,
    visitorHash,
    deviceType,
    browser,
    scannedAt: new Date(),
  });

  // Increment embedded counters on Campaign (fast read path for dashboard)
  await Campaign.updateOne(
    { _id: campaign._id },
    {
      $inc: { 'analytics.totalScans': 1 },
      $set: { 'analytics.lastScannedAt': new Date() },
    }
  );

  return success(res, {}, 'Scan recorded');
});

/* ─────────────────────────────────────────
   PATCH /api/public/campaigns/:id/session
   Called by the AR engine when the experience ends (page unload / target lost).
   Updates sessionDurationMs and videoWatchPercent on the most recent ScanEvent
   for this visitor in this campaign session.
   ───────────────────────────────────────── */
router.patch('/campaigns/:id/session', publicLimiter, async (req, res) => {
  const { visitorHash, sessionDurationMs, videoWatchPercent } = req.body;

  if (!visitorHash) return success(res, {}, 'No session data');

  // Update the most-recent ScanEvent for this visitor + campaign
  await ScanEvent.findOneAndUpdate(
    {
      campaignId:  req.params.id,
      visitorHash,
    },
    {
      $max: {
        sessionDurationMs: Number(sessionDurationMs) || 0,
        videoWatchPercent: Math.min(100, Number(videoWatchPercent) || 0),
      },
    },
    { sort: { scannedAt: -1 } }
  );

  return success(res, {}, 'Session updated');
});

const singleLinkSlugLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${getClientIpFromRequest(req)}:${req.params.slug || ''}`,
  message: 'Too many requests for this link. Please try again shortly.',
});

const multiLinkClickLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${getClientIpFromRequest(req)}:${req.params.slug || ''}`,
  message: 'Too many link clicks. Please try again shortly.',
});

/* ─────────────────────────────────────────
   Dynamic QR meta — single-link + multiple-links (bridge + hub)
   ───────────────────────────────────────── */

router.get('/dynamic-qr/:slug/meta', singleLinkSlugLimiter, async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) throw new AppError('Invalid link code', 400);

  const cached = await dynamicQrMetaCache.get(slug);
  if (cached) return success(res, cached);

  const campaign = await Campaign.findOne(
    {
      redirectSlug: slug,
      campaignType: {
        $in: [
          'single-link-qr',
          'multiple-links-qr',
          'links-video-qr',
          'links-doc-video-qr',
        ],
      },
    },
    'campaignName campaignType destinationUrl preciseGeoAnalytics redirectSlug linkItems '
      + 'videoSource videoUrl externalVideoUrl thumbnailUrl videoItems docItems status'
  ).lean();

  if (!campaign) throw new AppError('Link not found', 404);
  if (campaign.status === 'draft') throw new AppError('Link not found', 404);

  if (campaign.campaignType === 'single-link-qr') {
    if (campaign.status !== 'active') throw new AppError('Link not found', 404);
    const payload = {
      campaignType: 'single-link-qr',
      campaignName: campaign.campaignName,
      destinationUrl: campaign.destinationUrl,
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };
    await dynamicQrMetaCache.set(slug, payload);
    return success(res, payload);
  }

  // Hub-based types — paused state still resolves to a friendly "owner paused"
  // page so we always reply with cached structure rather than 404.
  if (campaign.status === 'paused') {
    const payload = {
      campaignType: campaign.campaignType,
      campaignName: campaign.campaignName,
      status: 'paused',
      paused: true,
      links: [],
      videoItems: [],
      docItems: [],
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };
    await dynamicQrMetaCache.set(slug, payload);
    return success(res, payload);
  }

  if (campaign.status !== 'active') throw new AppError('Link not found', 404);

  if (campaign.campaignType === 'links-video-qr') {
    const embedSrc =
      campaign.videoSource === 'link' && campaign.externalVideoUrl
        ? toEmbedSrc(campaign.externalVideoUrl)
        : null;
    const embedHost =
      campaign.videoSource === 'link' && campaign.externalVideoUrl
        ? detectVideoHost(campaign.externalVideoUrl)
        : null;

    const payload = {
      campaignType: 'links-video-qr',
      campaignName: campaign.campaignName,
      videoSource: campaign.videoSource,
      videoUrl: campaign.videoSource === 'upload' ? campaign.videoUrl : null,
      externalVideoUrl:
        campaign.videoSource === 'link' ? campaign.externalVideoUrl : null,
      embedSrc,
      embedHost,
      thumbnailUrl: campaign.thumbnailUrl || null,
      links: toPublicLinkList(campaign.linkItems || []),
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };

    await dynamicQrMetaCache.set(slug, payload);
    return success(res, payload);
  }

  if (campaign.campaignType === 'links-doc-video-qr') {
    // Resolve embed src/host once per video on the server so the client never
    // has to parse external URLs (and never sees raw ones for the upload mode).
    const videoItems = (campaign.videoItems || []).map((vi) => {
      const isLink = vi.source === 'link' && vi.externalVideoUrl;
      return {
        videoId: vi.videoId,
        label: vi.label,
        source: vi.source,
        videoUrl: vi.source === 'upload' ? vi.url : null,
        externalVideoUrl: isLink ? vi.externalVideoUrl : null,
        embedSrc: isLink ? toEmbedSrc(vi.externalVideoUrl) : null,
        embedHost: isLink ? detectVideoHost(vi.externalVideoUrl) : null,
        thumbnailUrl: vi.thumbnailUrl || null,
      };
    });

    const docItems = (campaign.docItems || []).map((di) => ({
      docId: di.docId,
      label: di.label,
      url: di.url,
      mimeType: di.mimeType || null,
      bytes: di.bytes || 0,
    }));

    const payload = {
      campaignType: 'links-doc-video-qr',
      campaignName: campaign.campaignName,
      videoSource: campaign.videoSource,
      videoItems,
      docItems,
      links: toPublicLinkList(campaign.linkItems || []),
      preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
      slug: campaign.redirectSlug,
    };

    await dynamicQrMetaCache.set(slug, payload);
    return success(res, payload);
  }

  const payload = {
    campaignType: 'multiple-links-qr',
    campaignName: campaign.campaignName,
    links: toPublicLinkList(campaign.linkItems || []),
    preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
    slug: campaign.redirectSlug,
  };

  await dynamicQrMetaCache.set(slug, payload);
  return success(res, payload);
});

/* ─────────────────────────────────────────
   Multiple-links hub — scan, session, click
   ───────────────────────────────────────── */

router.post(
  '/multi-link/:slug/scan',
  singleLinkSlugLimiter,
  validate(publicMultiLinkScanSchema),
  async (req, res) => {
    const { slug } = req.params;
    if (!SLUG_RE.test(slug)) throw new AppError('Invalid link code', 400);

    const campaign = await Campaign.findOne(
      {
        redirectSlug: slug,
        status: 'active',
        campaignType: { $in: HUB_CAMPAIGN_TYPES },
      },
      '_id preciseGeoAnalytics'
    ).lean();

    if (!campaign) throw new AppError('Link not found', 404);

    const {
      visitorHash,
      deviceType,
      browser,
      latitude,
      longitude,
      accuracyM,
      consentVersion,
    } = req.body;

    scanQueue.enqueue({
      campaignId: campaign._id,
      slug,
      ip: getClientIpFromRequest(req),
      ua: req.get('user-agent'),
      cfCountry: getCfIpCountry(req),
      ts: Date.now(),
      allowBrowserGeo: campaign.preciseGeoAnalytics === true,
      browserLatitude: latitude,
      browserLongitude: longitude,
      browserAccuracyM: accuracyM,
      consentVersion,
      visitorHash,
      deviceType,
      browser,
    });

    return success(res, {}, 'Scan recorded');
  }
);

/** POST + PATCH — POST supports navigator.sendBeacon (beacon is always POST). */
const updateMultiLinkSession = async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) throw new AppError('Invalid link code', 400);

  const campaign = await Campaign.findOne(
    {
      redirectSlug: slug,
      status: 'active',
      campaignType: { $in: HUB_CAMPAIGN_TYPES },
    },
    '_id'
  ).lean();

  if (!campaign) throw new AppError('Link not found', 404);

  const { visitorHash, sessionDurationMs } = req.body;

  await ScanEvent.findOneAndUpdate(
    {
      campaignId: campaign._id,
      visitorHash,
    },
    {
      $max: {
        sessionDurationMs: Number(sessionDurationMs) || 0,
      },
    },
    { sort: { scannedAt: -1 } }
  );

  return success(res, {}, 'Session updated');
};

router.patch(
  '/multi-link/:slug/session',
  singleLinkSlugLimiter,
  validate(publicMultiLinkSessionSchema),
  updateMultiLinkSession
);

router.post(
  '/multi-link/:slug/session',
  singleLinkSlugLimiter,
  validate(publicMultiLinkSessionSchema),
  updateMultiLinkSession
);

router.post(
  '/multi-link/:slug/click',
  multiLinkClickLimiter,
  validate(publicMultiLinkClickSchema),
  async (req, res) => {
    const { slug } = req.params;
    if (!SLUG_RE.test(slug)) throw new AppError('Invalid link code', 400);

    const campaign = await Campaign.findOne(
      {
        redirectSlug: slug,
        status: 'active',
        campaignType: { $in: HUB_CAMPAIGN_TYPES },
      },
      '_id userId linkItems docItems'
    ).lean();

    if (!campaign) throw new AppError('Link not found', 404);

    const { linkId, visitorHash } = req.body;
    const kind = req.body.kind === 'document' ? 'document' : 'link';

    if (kind === 'document') {
      const allowed = new Set((campaign.docItems || []).map((x) => x.docId));
      if (!allowed.has(linkId)) throw new AppError('Invalid document', 400);
    } else {
      const allowed = new Set((campaign.linkItems || []).map((x) => x.linkId));
      if (!allowed.has(linkId)) throw new AppError('Invalid link', 400);
    }

    LinkClickEvent.create({
      campaignId: campaign._id,
      userId: campaign.userId,
      linkId,
      kind,
      visitorHash: visitorHash || null,
      clickedAt: new Date(),
    }).catch(() => {});

    // Mirror the existing linkClickTotals pattern for fast per-asset reads.
    const totalsPath = kind === 'document'
      ? `analytics.docOpenTotals.${linkId}`
      : `analytics.linkClickTotals.${linkId}`;
    void Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { [totalsPath]: 1 } }
    ).catch((err) => {
      logger.warn(`analytics.${kind === 'document' ? 'docOpenTotals' : 'linkClickTotals'} inc failed`, {
        linkId,
        error: err.message,
      });
    });

    return success(res, {}, 'Click recorded');
  }
);

router.post(
  '/multi-link/:slug/video',
  singleLinkSlugLimiter,
  validate(publicMultiLinkVideoSchema),
  async (req, res) => {
    const { slug } = req.params;
    if (!SLUG_RE.test(slug)) throw new AppError('Invalid link code', 400);

    const campaign = await Campaign.findOne(
      {
        redirectSlug: slug,
        status: 'active',
        campaignType: { $in: VIDEO_CAPABLE_HUB_TYPES },
      },
      '_id userId campaignType videoItems'
    ).lean();

    if (!campaign) throw new AppError('Link not found', 404);

    const {
      visitorHash,
      event,
      videoId,
      positionSec,
      durationSec,
      watchPercent,
    } = req.body;

    const maxPercent = (() => {
      if (event === 'ended') return 100;
      if (typeof watchPercent === 'number') return Math.max(0, Math.min(100, watchPercent));
      if (typeof durationSec === 'number' && durationSec > 0 && typeof positionSec === 'number') {
        return Math.max(0, Math.min(100, (positionSec / durationSec) * 100));
      }
      return 0;
    })();

    const maxSec = typeof positionSec === 'number'
      ? Math.max(0, positionSec)
      : 0;

    // Resolve videoId if the campaign supports per-asset attribution. We only
    // accept ids that exist on the campaign so spoofed beacons can't pollute
    // the per-video totals.
    let resolvedVideoId = null;
    if (campaign.campaignType === 'links-doc-video-qr' && typeof videoId === 'string') {
      const allowed = new Set((campaign.videoItems || []).map((x) => x.videoId));
      if (allowed.has(videoId)) resolvedVideoId = videoId;
    }

    const update = { $set: { videoPlayed: true } };
    if (event === 'progress' || event === 'ended') {
      update.$max = {
        videoWatchedSec: maxSec,
        videoWatchPercent: maxPercent,
      };
    }

    await ScanEvent.findOneAndUpdate(
      {
        campaignId: campaign._id,
        visitorHash,
      },
      {
        ...update,
        $setOnInsert: {
          campaignId: campaign._id,
          userId: campaign.userId,
          visitorHash,
          deviceType: 'unknown',
          browser: 'unknown',
          os: 'unknown',
          geoSource: 'ip',
          sessionDurationMs: 0,
          videoWatchPercent: 0,
          videoWatchedSec: 0,
          scannedAt: new Date(),
        },
      },
      { sort: { scannedAt: -1 }, upsert: true }
    );

    if (resolvedVideoId) {
      // Per-asset row — collapsed to one document per (campaign, video, visitor)
      // via the unique compound index, so totals stay bounded for any traffic.
      // The compound filter (campaignId + videoId + visitorHash) lives in the
      // query so we only $setOnInsert fields not already implied by the
      // filter — Mongo refuses path conflicts between filter and $setOnInsert.
      const playEventUpdate = {
        $max: {
          watchedSec: maxSec,
          watchPercent: maxPercent,
        },
        $set: { occurredAt: new Date() },
        $setOnInsert: { userId: campaign.userId },
      };

      VideoPlayEvent.findOneAndUpdate(
        {
          campaignId: campaign._id,
          videoId: resolvedVideoId,
          visitorHash: visitorHash || null,
        },
        playEventUpdate,
        { upsert: true }
      ).catch((err) => {
        logger.warn('VideoPlayEvent upsert failed', {
          videoId: resolvedVideoId,
          error: err.message,
        });
      });

      // Counter on the campaign for fast per-asset lookups (mirrors linkClickTotals).
      // Only inc on `play` so progress/ended beacons can't inflate the count.
      if (event === 'play') {
        void Campaign.updateOne(
          { _id: campaign._id },
          { $inc: { [`analytics.videoPlayTotals.${resolvedVideoId}`]: 1 } }
        ).catch((err) => {
          logger.warn('analytics.videoPlayTotals inc failed', {
            videoId: resolvedVideoId,
            error: err.message,
          });
        });
      }
    }

    return success(res, {}, 'Video event recorded');
  }
);

/* ─────────────────────────────────────────
   Single-link QR bridge (precise geo analytics)
   ───────────────────────────────────────── */

router.get('/single-link/:slug/meta', singleLinkSlugLimiter, async (req, res) => {
  const { slug } = req.params;
  if (!SLUG_RE.test(slug)) throw new AppError('Invalid link code', 400);

  const campaign = await Campaign.findOne(
    { redirectSlug: slug, status: 'active', campaignType: 'single-link-qr' },
    'campaignName destinationUrl preciseGeoAnalytics redirectSlug'
  ).lean();

  if (!campaign) throw new AppError('Link not found', 404);

  return success(res, {
    campaignName: campaign.campaignName,
    destinationUrl: campaign.destinationUrl,
    preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
    slug: campaign.redirectSlug,
  });
});

router.post(
  '/single-link/:slug/scan',
  singleLinkSlugLimiter,
  validate(publicSingleLinkScanSchema),
  async (req, res) => {
    const { slug } = req.params;
    if (!SLUG_RE.test(slug)) throw new AppError('Invalid link code', 400);

    const campaign = await Campaign.findOne(
      { redirectSlug: slug, status: 'active', campaignType: 'single-link-qr' },
      '_id destinationUrl preciseGeoAnalytics'
    ).lean();

    if (!campaign) throw new AppError('Link not found', 404);

    const { latitude, longitude, accuracyM, consentVersion } = req.body;

    scanQueue.enqueue({
      campaignId: campaign._id,
      slug,
      ip: getClientIpFromRequest(req),
      ua: req.get('user-agent'),
      cfCountry: getCfIpCountry(req),
      ts: Date.now(),
      allowBrowserGeo: campaign.preciseGeoAnalytics === true,
      browserLatitude: latitude,
      browserLongitude: longitude,
      browserAccuracyM: accuracyM,
      consentVersion,
    });

    return success(res, { destinationUrl: campaign.destinationUrl }, 'Scan recorded');
  }
);

/* ─────────────────────────────────────────
   Digital Business Card — public meta + telemetry
   The slug here is the friendly `cardSlug` (kebab-case, 3-60 chars), distinct
   from the 8-char `redirectSlug` used for the printed QR. Both resolve to
   the same campaign — `redirectSlug` falls back when no friendly slug is
   set (e.g. before the user customizes the URL).
   ───────────────────────────────────────── */

const cardSlugLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${getClientIpFromRequest(req)}:${req.params.slug || ''}`,
  message: 'Too many requests for this card. Please try again shortly.',
});

const cardActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${getClientIpFromRequest(req)}:${req.params.slug || ''}`,
  message: 'Too many actions. Please try again shortly.',
});

/** Common slug-shape guard used by every card endpoint. */
const isValidCardSlug = (slug) =>
  typeof slug === 'string' && (CARD_SLUG_RE.test(slug) || SLUG_RE.test(slug));

/**
 * Apply Cloudinary responsive transforms to every image URL in a card's
 * public payload so mobile browsers receive WebP/AVIF + right-sized
 * variants. Server-side transformation keeps the contract opaque to
 * the client.
 */
const applyImageTransforms = (cardContent) => {
  if (!cardContent) return cardContent;
  const next = { ...cardContent };
  if (next.profileImageUrl) {
    next.profileImageUrl = cloudinaryTransform(next.profileImageUrl, { w: 480, h: 480, crop: 'fill', gravity: 'face' });
  }
  if (next.bannerImageUrl) {
    next.bannerImageUrl = cloudinaryTransform(next.bannerImageUrl, { w: 1200, h: 600, crop: 'fill' });
  }
  if (Array.isArray(next.sections)) {
    next.sections = next.sections.map((sec) => {
      if (sec.type === 'imageGallery' && Array.isArray(sec.images)) {
        return {
          ...sec,
          images: sec.images.map((img) => ({
            ...img,
            url: cloudinaryTransform(img.url, { w: 800 }),
          })),
        };
      }
      return sec;
    });
  }
  return next;
};

const findCardCampaign = async (slug) => {
  const filter = {
    campaignType: 'digital-business-card',
    isDeleted: { $ne: true },
    $or: [{ cardSlug: slug }, { redirectSlug: slug }],
  };
  return Campaign.findOne(
    filter,
    'campaignName cardSlug redirectSlug visibility status cardContent cardDesign cardPrintSettings preciseGeoAnalytics'
  ).lean();
};

/* GET /api/public/card/:slug/meta — public payload for the hub renderer. */
router.get('/card/:slug/meta', cardSlugLimiter, async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidCardSlug(slug)) throw new AppError('Invalid card link', 400);

  const cached = await cardMetaCache.get(slug);
  if (cached) return success(res, cached);

  const campaign = await findCardCampaign(slug);
  if (!campaign) throw new AppError('Card not found', 404);
  if (campaign.visibility === 'private') {
    throw new AppError('This card is private', 404);
  }
  if (campaign.status === 'draft') throw new AppError('Card not found', 404);

  // Resolve any video sections to embed-safe URLs server-side so the client
  // never has to parse external URLs.
  const sections = (campaign.cardContent?.sections || []).map((sec) => {
    if (sec.type === 'video' && sec.source === 'link' && sec.externalVideoUrl) {
      return {
        ...sec,
        embedSrc: toEmbedSrc(sec.externalVideoUrl),
        embedHost: detectVideoHost(sec.externalVideoUrl),
      };
    }
    return sec;
  });

  const cardContent = applyImageTransforms({
    ...(campaign.cardContent || {}),
    sections,
  });

  const payload = {
    campaignName: campaign.campaignName,
    cardSlug: campaign.cardSlug,
    redirectSlug: campaign.redirectSlug,
    status: campaign.status,
    paused: campaign.status === 'paused',
    cardContent,
    cardDesign: campaign.cardDesign || null,
  };

  await cardMetaCache.set(slug, payload);
  return success(res, payload);
});

/* POST /api/public/card/:slug/scan — first-load telemetry. */
router.post(
  '/card/:slug/scan',
  cardSlugLimiter,
  validate(publicCardScanSchema),
  async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!isValidCardSlug(slug)) throw new AppError('Invalid card link', 400);

    const campaign = await findCardCampaign(slug);
    if (!campaign) throw new AppError('Card not found', 404);
    if (campaign.visibility === 'private') throw new AppError('Card not found', 404);
    if (campaign.status !== 'active') return success(res, {}, 'Scan ignored');

    const {
      visitorHash,
      deviceType,
      browser,
      latitude,
      longitude,
      accuracyM,
      consentVersion,
    } = req.body;

    scanQueue.enqueue({
      campaignId: campaign._id,
      slug,
      visitorHash,
      ip: getClientIpFromRequest(req),
      ua: req.get('user-agent'),
      cfCountry: getCfIpCountry(req),
      deviceType,
      browser,
      ts: Date.now(),
      allowBrowserGeo: campaign.preciseGeoAnalytics === true,
      browserLatitude: latitude,
      browserLongitude: longitude,
      browserAccuracyM: accuracyM,
      consentVersion,
    });

    return success(res, {}, 'Scan recorded');
  }
);

/* POST /api/public/card/:slug/action — call/email/whatsapp/social/etc. */
router.post(
  '/card/:slug/action',
  cardActionLimiter,
  validate(publicCardActionSchema),
  async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!isValidCardSlug(slug)) throw new AppError('Invalid card link', 400);

    const campaign = await findCardCampaign(slug);
    if (!campaign) throw new AppError('Card not found', 404);
    if (campaign.visibility === 'private') throw new AppError('Card not found', 404);
    if (campaign.status !== 'active') return success(res, {}, 'Action ignored');

    const { action, target, visitorHash } = req.body;
    cardActionQueue.enqueue({
      campaignId: campaign._id,
      userId: campaign.userId || null,
      action,
      target,
      visitorHash,
    });

    return res.status(202).json({ status: 'queued' });
  }
);

/* POST /api/public/card/:slug/session — total session duration. */
router.post(
  '/card/:slug/session',
  cardActionLimiter,
  validate(publicCardSessionSchema),
  async (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!isValidCardSlug(slug)) throw new AppError('Invalid card link', 400);

    const campaign = await findCardCampaign(slug);
    if (!campaign) return success(res, {}, 'No card');
    if (campaign.visibility === 'private') return success(res, {}, 'No card');

    const { visitorHash, sessionDurationMs } = req.body;
    if (!visitorHash) return success(res, {}, 'No session data');

    await ScanEvent.findOneAndUpdate(
      { campaignId: campaign._id, visitorHash },
      { $max: { sessionDurationMs: Number(sessionDurationMs) || 0 } },
      { sort: { scannedAt: -1 } }
    );

    return success(res, {}, 'Session updated');
  }
);

/* GET /api/public/card-render/status/:jobId — poll BullMQ job result. */
router.get('/card-render/status/:jobId', publicLimiter, async (req, res) => {
  const status = await getRenderJobStatus(req.params.jobId);
  return success(res, status);
});

/* GET /api/public/card/print-token/verify?token=&campaignId= — Puppeteer
 * authenticates against the print page using a short-lived HMAC token rather
 * than user cookies. Exposed publicly so the print client can show a friendly
 * "expired" UI rather than a server-side 401. */
router.get('/card/print-token/verify', publicLimiter, async (req, res) => {
  const ok = verifyPrintToken(req.query.token, req.query.campaignId);
  return success(res, { valid: !!ok });
});

module.exports = router;
