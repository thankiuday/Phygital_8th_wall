'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Campaign = require('../models/Campaign');
const ScanEvent = require('../models/ScanEvent');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

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
      $max: { sessionDurationMs: Number(sessionDurationMs) || 0 },
      $max: { videoWatchPercent: Math.min(100, Number(videoWatchPercent) || 0) },
    },
    { sort: { scannedAt: -1 } }
  );

  return success(res, {}, 'Session updated');
});

module.exports = router;
