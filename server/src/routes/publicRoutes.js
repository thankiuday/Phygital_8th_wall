'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Campaign = require('../models/Campaign');
const ScanEvent = require('../models/ScanEvent');
const LinkClickEvent = require('../models/LinkClickEvent');
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
} = require('../validators/publicScanValidators');
const { toPublicLinkList } = require('../utils/linkItemResolver');
const { SLUG_RE } = require('../constants/singleLinkSlug');
const { dynamicQrMetaCache } = require('../utils/redirectCache');
const logger = require('../config/logger');

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
      status: 'active',
      campaignType: { $in: ['single-link-qr', 'multiple-links-qr'] },
    },
    'campaignName campaignType destinationUrl preciseGeoAnalytics redirectSlug linkItems'
  ).lean();

  if (!campaign) throw new AppError('Link not found', 404);

  const payload =
    campaign.campaignType === 'single-link-qr'
      ? {
        campaignType: 'single-link-qr',
        campaignName: campaign.campaignName,
        destinationUrl: campaign.destinationUrl,
        preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
        slug: campaign.redirectSlug,
      }
      : {
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
      { redirectSlug: slug, status: 'active', campaignType: 'multiple-links-qr' },
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
    { redirectSlug: slug, status: 'active', campaignType: 'multiple-links-qr' },
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
      { redirectSlug: slug, status: 'active', campaignType: 'multiple-links-qr' },
      '_id userId linkItems'
    ).lean();

    if (!campaign) throw new AppError('Link not found', 404);

    const { linkId, visitorHash } = req.body;
    const allowed = new Set((campaign.linkItems || []).map((x) => x.linkId));
    if (!allowed.has(linkId)) throw new AppError('Invalid link', 400);

    LinkClickEvent.create({
      campaignId: campaign._id,
      userId: campaign.userId,
      linkId,
      visitorHash: visitorHash || null,
      clickedAt: new Date(),
    }).catch(() => {});

    void Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { [`analytics.linkClickTotals.${linkId}`]: 1 } }
    ).catch((err) => {
      logger.warn('analytics.linkClickTotals inc failed', { linkId, error: err.message });
    });

    return success(res, {}, 'Click recorded');
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

module.exports = router;
