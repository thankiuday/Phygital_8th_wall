'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const Campaign = require('../models/Campaign');
const { SLUG_RE } = require('../constants/singleLinkSlug');
const { redirectCache } = require('../utils/redirectCache');
const scanQueue = require('../utils/scanQueue');
const { getClientIpFromRequest, getCfIpCountry } = require('../utils/geoLookup');
const logger = require('../config/logger');

/**
 * Per-IP + per-slug rate limit.
 *
 * The composite key keeps legitimate scan traffic flowing (a popular printed
 * QR will see many distinct IPs hit the same slug) while still protecting
 * against the QR-spam attack where one client repeatedly hits the same slug.
 */
const slugLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // per (ip, slug) per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${getClientIpFromRequest(req)}:${req.params.slug || ''}`,
  message: 'Too many scans of this code from your network. Please try again shortly.',
});

/**
 * GET /r/:slug
 *
 * Scan-handling hot path.  Targets:
 *   • cache hit  → < 5 ms server time
 *   • cache miss → < 30 ms server time (one indexed Mongo lookup)
 *
 * Critical invariants:
 *   1. Never await scan persistence — fire-and-forget through scanQueue.
 *   2. 302 (not 301) so destination edits propagate immediately.
 *   3. `Cache-Control: no-store` so intermediaries can't cache the redirect.
 *   4. `Referrer-Policy: no-referrer` so the destination doesn't see the slug.
 */
router.get('/:slug', slugLimiter, async (req, res) => {
  const t0 = process.hrtime.bigint();
  const { slug } = req.params;
  const clientIp = getClientIpFromRequest(req);

  if (!SLUG_RE.test(slug)) {
    return res.status(400).type('html').send('<h1>Invalid QR code</h1>');
  }

  let camp = await redirectCache.get(slug);

  if (!camp) {
    camp = await Campaign.findOne(
      {
        redirectSlug: slug,
        $or: [
          { campaignType: 'single-link-qr', status: 'active' },
          {
            campaignType: { $in: ['multiple-links-qr', 'links-video-qr'] },
            status: { $in: ['active', 'paused'] },
          },
        ],
      },
      'destinationUrl campaignType _id'
    ).lean();

    if (camp) {
      await redirectCache.set(slug, camp);
    }
  }

  if (!camp) {
    logger.warn('redirect.miss', { slug, ip: clientIp });
    return res
      .status(404)
      .type('html')
      .send('<!doctype html><meta charset="utf-8"><title>QR not active</title><h1>This QR is not active.</h1>');
  }

  const clientBase = (process.env.CLIENT_URL || '').replace(/\/$/, '');

  if (camp.campaignType === 'multiple-links-qr' || camp.campaignType === 'links-video-qr') {
    if (!clientBase) {
      logger.error('redirect.multiLinkMissingClientUrl', { slug });
      return res
        .status(503)
        .type('html')
        .send('<!doctype html><meta charset="utf-8"><title>Unavailable</title><h1>Link page is not configured.</h1>');
    }
    res.set('Cache-Control', 'no-store, private');
    res.set('Referrer-Policy', 'no-referrer');
    return res.redirect(302, `${clientBase}/l/${slug}`);
  }

  scanQueue.enqueue({
    campaignId: camp._id,
    slug,
    ip: clientIp,
    ua: req.get('user-agent'),
    referer: req.get('referer'),
    cfCountry: getCfIpCountry(req),
    ts: Date.now(),
    allowBrowserGeo: false,
  });

  res.set('Cache-Control', 'no-store, private');
  res.set('Referrer-Policy', 'no-referrer');
  res.redirect(302, camp.destinationUrl);

  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  if (ms > 50) {
    logger.warn('redirect.slow', { slug, ms: Math.round(ms) });
  }
});

module.exports = router;
