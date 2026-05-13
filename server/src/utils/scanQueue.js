'use strict';

/**
 * scanQueue.js — pluggable fire-and-forget queue for scan-event persistence.
 *
 * The /r/:slug redirect path MUST NEVER block on scan persistence.  Even with
 * Mongo a few ms away a slow write would visibly delay the redirect, and
 * during a Mongo outage the redirect must continue to function.  All paths
 * here are best-effort.
 *
 * Backends
 *   • Default (zero-infra) : direct ScanEvent.create, errors logged + swallowed.
 *                            Equivalent to today's behavior.
 *
 *   • BullMQ (production)  : auto-enabled when REDIS_URL is set.  enqueue()
 *                            pushes a job to a Redis-backed queue and returns
 *                            instantly.  A separate worker process consumes
 *                            jobs (see workers/scanWorker.js).  Survives
 *                            crashes, supports retries / DLQ.
 *
 * Public API
 *   scanQueue.enqueue(event)         → void (fire-and-forget)
 *   scanQueue.normalizeAndPersist(e) → Promise<void>  // shared by both backends
 *   scanQueue.backend                 → 'direct' | 'bullmq'
 */

const crypto = require('crypto');
const logger = require('../config/logger');
const ScanEvent = require('../models/ScanEvent');
const Campaign = require('../models/Campaign');
const { bumpRollupsForScan } = require('../services/analyticsRollupService');
const { lookupGeo, enrichLocationLabelsFromCoords } = require('./geoLookup');

// ── PII guard ────────────────────────────────────────────────────────────
// Hash IPs with a server-side salt before persisting.  We can still count
// unique scans (same IP within session) but raw IPs never hit the disk.
const IP_SALT = process.env.IP_SALT || 'phygital8thwall-default-salt';

const hashIp = (ip) => {
  if (!ip) return null;
  return crypto.createHash('sha256').update(`${ip}|${IP_SALT}`).digest('hex').slice(0, 32);
};

// Tiny UA classifier — enough for the dashboard's "device type" pie chart.
const classifyDevice = (ua = '') => {
  const u = ua.toLowerCase();
  if (/iphone|ipod|android.*mobile|windows phone|opera mini/.test(u)) return 'mobile';
  if (/ipad|android(?!.*mobile)|tablet/.test(u)) return 'tablet';
  if (/mozilla|chrome|safari|firefox|edge|opera/.test(u)) return 'desktop';
  return 'unknown';
};

const classifyBrowser = (ua = '') => {
  const u = String(ua || '').toLowerCase();
  if (!u.trim()) return 'unknown';
  if (u.includes('samsungbrowser')) return 'Samsung';
  if (u.includes('edg/')) return 'Edge';
  if (u.includes('opr/') || u.includes('opera')) return 'Opera';
  if (u.includes('firefox/')) return 'Firefox';
  if (u.includes('crios/') || u.includes('chrome/')) return 'Chrome';
  if (u.includes('safari/') && !u.includes('chrome/') && !u.includes('crios/')) return 'Safari';
  return 'Other';
};

/**
 * normalizeAndPersist — single source of truth for what a scan event looks like
 * once written to disk.  Used by both backends so the on-disk shape stays
 * identical regardless of whether we're going direct or via BullMQ.
 */
const normalizeAndPersist = async (event) => {
  // Resolve the campaign owner (we need userId on ScanEvent for the analytics
  // dashboard).  This adds one cheap indexed lookup, but we're already off the
  // hot path here.
  const camp = await Campaign.findById(event.campaignId, '_id userId preciseGeoAnalytics').lean();
  if (!camp) return; // Campaign deleted between scan and worker

  const geo = await lookupGeo(event.ip, {
    cfCountryCode: event.cfCountry || event.cfCountryCode || null,
  });

  let country = geo?.country ?? null;
  let region = geo?.region ?? null;
  let city = geo?.city ?? null;
  let latitude = geo?.latitude ?? null;
  let longitude = geo?.longitude ?? null;

  let geoSource = 'ip';
  let locationAccuracyM = null;
  let geoConsentVersion = null;

  const allowGeo =
    event.allowBrowserGeo === true
    && camp.preciseGeoAnalytics === true;

  const blat = event.browserLatitude;
  const blng = event.browserLongitude;
  if (
    allowGeo
    && typeof blat === 'number'
    && typeof blng === 'number'
    && Number.isFinite(blat)
    && Number.isFinite(blng)
    && blat >= -90
    && blat <= 90
    && blng >= -180
    && blng <= 180
  ) {
    geoSource = country || region || city ? 'hybrid' : 'browser';
    latitude = blat;
    longitude = blng;
    const acc = event.browserAccuracyM;
    locationAccuracyM =
      typeof acc === 'number' && Number.isFinite(acc) && acc >= 0 ? acc : null;
    if (event.consentVersion) {
      geoConsentVersion = String(event.consentVersion).slice(0, 128);
    }
  }

  if (
    Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && (!city || !String(city).trim() || !region || !String(region).trim())
  ) {
    const enriched = await enrichLocationLabelsFromCoords(latitude, longitude, {
      country,
      region,
      city,
    });
    country = enriched.country ?? country;
    region = enriched.region ?? region;
    city = enriched.city ?? city;
    if (Number.isFinite(enriched.latitude)) latitude = enriched.latitude;
    if (Number.isFinite(enriched.longitude)) longitude = enriched.longitude;
  }

  const visitorHash =
    typeof event.visitorHash === 'string' && event.visitorHash.trim().length > 0
      ? event.visitorHash.trim().slice(0, 128)
      : hashIp(event.ip);

  const scanDoc = await ScanEvent.create({
    campaignId: camp._id,
    userId: camp.userId,
    visitorHash,
    deviceType:
      event.deviceType && ['mobile', 'tablet', 'desktop', 'unknown'].includes(event.deviceType)
        ? event.deviceType
        : classifyDevice(event.ua),
    browser: typeof event.browser === 'string' && event.browser.trim()
      ? event.browser.trim().slice(0, 64)
      : classifyBrowser(event.ua),
    os: 'unknown',
    country,
    region,
    city,
    latitude,
    longitude,
    geoSource,
    locationAccuracyM,
    geoConsentVersion,
    scannedAt: event.ts ? new Date(event.ts) : new Date(),
  });

  try {
    await bumpRollupsForScan(scanDoc);
  } catch (err) {
    logger.warn('analytics rollup bump failed', { error: err.message });
  }

  // Update embedded counters on the campaign — best-effort; no-op if it fails.
  await Campaign.updateOne(
    { _id: camp._id },
    {
      $inc: { 'analytics.totalScans': 1 },
      $set: { 'analytics.lastScannedAt': new Date(event.ts || Date.now()) },
    }
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Backend: direct (default)
   ─────────────────────────────────────────────────────────────────────────── */

const directBackend = {
  backend: 'direct',
  enqueue(event) {
    // Don't await; log if it errors.  Critical: the redirect handler should
    // ALREADY have called res.redirect() before this function is invoked.
    Promise.resolve()
      .then(() => normalizeAndPersist(event))
      .catch((err) => logger.warn('scanQueue.direct persist failed', { error: err.message }));
  },
};

/* ─────────────────────────────────────────────────────────────────────────────
   Backend: BullMQ (lazy / optional)
   ─────────────────────────────────────────────────────────────────────────── */

const buildBullmq = (redisUrl) => {
  let Queue;
  try {
    ({ Queue } = require('bullmq'));
  } catch (err) {
    logger.warn('scanQueue: REDIS_URL set but bullmq is not installed — using direct backend', {
      error: err.message,
    });
    return directBackend;
  }

  const connection = (() => {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: Number(url.port) || 6379,
        username: url.username || undefined,
        password: url.password || undefined,
        // Required by BullMQ — see https://docs.bullmq.io/guide/connections
        maxRetriesPerRequest: null,
      };
    } catch {
      logger.warn('scanQueue: invalid REDIS_URL — using direct backend');
      return null;
    }
  })();

  if (!connection) return directBackend;

  const queue = new Queue('scan-events', { connection });
  logger.info('scanQueue: backend=bullmq');

  return {
    backend: 'bullmq',
    enqueue(event) {
      queue
        .add('scan', event, {
          removeOnComplete: 1000,    // keep last 1000 succeeded jobs for debugging
          removeOnFail: 5000,        // keep last 5000 failures
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
        })
        .catch((err) => logger.warn('scanQueue.bullmq enqueue failed', { error: err.message }));
    },
  };
};

const adapter = process.env.REDIS_URL
  ? buildBullmq(process.env.REDIS_URL)
  : directBackend;

if (adapter.backend === 'direct') logger.info('scanQueue: backend=direct');

module.exports = { ...adapter, normalizeAndPersist };
