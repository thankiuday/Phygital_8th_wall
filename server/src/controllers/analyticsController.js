'use strict';

/**
 * analyticsController.js
 *
 * All aggregations run against the ScanEvent collection.
 * Queries are scoped to the authenticated user's own data (req.user._id).
 *
 * Endpoints:
 *   GET /api/analytics/overview?period=7d|30d|90d
 *   GET /api/analytics/campaigns/:id?period=7d|30d|90d
 *   GET /api/analytics/trends?period=7d|30d|90d
 */

const mongoose = require('mongoose');
const ScanEvent = require('../models/ScanEvent');
const LinkClickEvent = require('../models/LinkClickEvent');
const Campaign  = require('../models/Campaign');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a Date for N days ago from now. */
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Maps period string to number of days. */
const periodDays = (period) => {
  const map = { '7d': 7, '30d': 30, '90d': 90 };
  return map[period] || 30;
};

/**
 * buildScanTrend — groups ScanEvents by calendar day over a date range.
 * Returns an array sorted ascending by date.
 *
 * @param {object} matchStage  Additional $match conditions (campaignId, userId, etc.)
 * @param {Date}   since
 * @returns {Promise<Array<{date, scans, uniqueScans}>>}
 */
const buildScanTrend = async (matchStage, since) => {
  const trend = await ScanEvent.aggregate([
    {
      $match: {
        ...matchStage,
        scannedAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' },
        },
        scans: { $sum: 1 },
        uniqueScans: { $addToSet: '$visitorHash' },
      },
    },
    {
      $project: {
        _id: 0,
        date: '$_id',
        scans: 1,
        uniqueScans: { $size: '$uniqueScans' },
      },
    },
    { $sort: { date: 1 } },
  ]);

  // Fill in days with zero scans so the chart has continuous data
  const result = [];
  const days = Math.round((Date.now() - since.getTime()) / 86_400_000);
  for (let i = 0; i <= days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const found = trend.find((t) => t.date === dateStr);
    result.push(found || { date: dateStr, scans: 0, uniqueScans: 0 });
  }
  return result;
};

/**
 * buildHourlyHeatmap — counts scans for each hour of the day (0–23).
 */
const buildHourlyHeatmap = async (matchStage, since) => {
  const raw = await ScanEvent.aggregate([
    { $match: { ...matchStage, scannedAt: { $gte: since } } },
    {
      $group: {
        _id: { $hour: '$scannedAt' },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = Object.fromEntries(raw.map((r) => [r._id, r.count]));
  return Array.from({ length: 24 }, (_, h) => ({ hour: h, count: map[h] || 0 }));
};

// ---------------------------------------------------------------------------
// GET /api/analytics/overview
// ---------------------------------------------------------------------------
exports.getOverview = async (req, res) => {
  const days  = periodDays(req.query.period);
  const since = daysAgo(days);
  const uid   = new mongoose.Types.ObjectId(req.user._id);

  const match = { userId: uid };

  // Run all aggregations in parallel
  const [
    totals,
    deviceBreakdown,
    browserBreakdown,
    topCampaigns,
    scanTrend,
    hourlyHeatmap,
  ] = await Promise.all([
    // ── Totals ─────────────────────────────────────────────────────────────
    ScanEvent.aggregate([
      { $match: match },
      {
        $facet: {
          allTime: [
            {
              $group: {
                _id: null,
                totalScans:           { $sum: 1 },
                uniqueVisitors:       { $addToSet: '$visitorHash' },
                avgSessionDuration:   { $avg: '$sessionDurationMs' },
                avgVideoWatchPercent: { $avg: '$videoWatchPercent' },
              },
            },
            {
              $project: {
                _id: 0,
                totalScans: 1,
                uniqueVisitors:       { $size: '$uniqueVisitors' },
                avgSessionDuration:   { $round: ['$avgSessionDuration', 0] },
                avgVideoWatchPercent: { $round: ['$avgVideoWatchPercent', 1] },
              },
            },
          ],
          period: [
            { $match: { scannedAt: { $gte: since } } },
            {
              $group: {
                _id: null,
                scans:          { $sum: 1 },
                uniqueVisitors: { $addToSet: '$visitorHash' },
              },
            },
            {
              $project: {
                _id: 0,
                scans: 1,
                uniqueVisitors: { $size: '$uniqueVisitors' },
              },
            },
          ],
        },
      },
    ]),

    // ── Device breakdown ───────────────────────────────────────────────────
    ScanEvent.aggregate([
      { $match: { ...match, scannedAt: { $gte: since } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
      { $project: { _id: 0, device: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]),

    // ── Browser breakdown ──────────────────────────────────────────────────
    ScanEvent.aggregate([
      { $match: { ...match, scannedAt: { $gte: since } } },
      {
        $addFields: {
          // Simplified browser name from user-agent string
          browserName: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: '$browser', regex: /SamsungBrowser/i } }, then: 'Samsung' },
                { case: { $regexMatch: { input: '$browser', regex: /OPR|Opera/i } }, then: 'Opera' },
                { case: { $regexMatch: { input: '$browser', regex: /Firefox/i } }, then: 'Firefox' },
                { case: { $regexMatch: { input: '$browser', regex: /Edg/i } }, then: 'Edge' },
                { case: { $regexMatch: { input: '$browser', regex: /Chrome/i } }, then: 'Chrome' },
                { case: { $regexMatch: { input: '$browser', regex: /Safari/i } }, then: 'Safari' },
              ],
              default: 'Other',
            },
          },
        },
      },
      { $group: { _id: '$browserName', count: { $sum: 1 } } },
      { $project: { _id: 0, browser: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]),

    // ── Top 5 campaigns ────────────────────────────────────────────────────
    ScanEvent.aggregate([
      { $match: { ...match, scannedAt: { $gte: since } } },
      {
        $group: {
          _id: '$campaignId',
          scans:          { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorHash' },
        },
      },
      { $sort: { scans: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'campaigns',
          localField: '_id',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      { $unwind: '$campaign' },
      {
        $project: {
          _id: 1,
          campaignName:   '$campaign.campaignName',
          thumbnailUrl:   '$campaign.thumbnailUrl',
          status:         '$campaign.status',
          scans:          1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
        },
      },
    ]),

    // ── Scan trend ─────────────────────────────────────────────────────────
    buildScanTrend(match, since),

    // ── Hourly heatmap ─────────────────────────────────────────────────────
    buildHourlyHeatmap(match, since),
  ]);

  const allTime = totals[0]?.allTime[0] || {
    totalScans: 0, uniqueVisitors: 0, avgSessionDuration: 0, avgVideoWatchPercent: 0,
  };
  const periodStats = totals[0]?.period[0] || { scans: 0, uniqueVisitors: 0 };

  return success(res, {
    period: `${days}d`,
    allTime,
    periodStats,
    deviceBreakdown,
    browserBreakdown,
    topCampaigns,
    scanTrend,
    hourlyHeatmap,
  });
};

// ---------------------------------------------------------------------------
// GET /api/analytics/campaigns/:id
// ---------------------------------------------------------------------------
exports.getCampaignAnalytics = async (req, res) => {
  const days  = periodDays(req.query.period);
  const since = daysAgo(days);
  const uid   = new mongoose.Types.ObjectId(req.user._id);
  const cid   = new mongoose.Types.ObjectId(req.params.id);

  // Verify the campaign belongs to this user
  const campaign = await Campaign.findOne(
    { _id: cid, userId: uid },
    'campaignName status analytics campaignType linkItems'
  ).lean();
  if (!campaign) throw new AppError('Campaign not found', 404);

  const match = { campaignId: cid };

  const linkLabelMap = Object.fromEntries(
    (campaign.linkItems || []).map((it) => [it.linkId, it.label])
  );

  const [
    totals,
    deviceBreakdown,
    browserBreakdown,
    scanTrend,
    hourlyHeatmap,
    locationBreakdown,
  ] = await Promise.all([
    ScanEvent.aggregate([
      { $match: match },
      {
        $facet: {
          allTime: [
            {
              $group: {
                _id: null,
                totalScans:           { $sum: 1 },
                uniqueVisitors:       { $addToSet: '$visitorHash' },
                avgSessionDuration:   { $avg: '$sessionDurationMs' },
                avgVideoWatchPercent: { $avg: '$videoWatchPercent' },
                repeatVisitors: {
                  $sum: { $cond: [{ $gt: ['$visitorHash', null] }, 1, 0] },
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalScans: 1,
                uniqueVisitors:       { $size: '$uniqueVisitors' },
                avgSessionDuration:   { $round: ['$avgSessionDuration', 0] },
                avgVideoWatchPercent: { $round: ['$avgVideoWatchPercent', 1] },
              },
            },
          ],
          period: [
            { $match: { scannedAt: { $gte: since } } },
            {
              $group: {
                _id: null,
                scans:          { $sum: 1 },
                uniqueVisitors: { $addToSet: '$visitorHash' },
              },
            },
            {
              $project: {
                _id: 0,
                scans: 1,
                uniqueVisitors: { $size: '$uniqueVisitors' },
              },
            },
          ],
        },
      },
    ]),

    ScanEvent.aggregate([
      { $match: { ...match, scannedAt: { $gte: since } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
      { $project: { _id: 0, device: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]),

    ScanEvent.aggregate([
      { $match: { ...match, scannedAt: { $gte: since } } },
      {
        $addFields: {
          browserName: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: '$browser', regex: /SamsungBrowser/i } }, then: 'Samsung' },
                { case: { $regexMatch: { input: '$browser', regex: /OPR|Opera/i } }, then: 'Opera' },
                { case: { $regexMatch: { input: '$browser', regex: /Firefox/i } }, then: 'Firefox' },
                { case: { $regexMatch: { input: '$browser', regex: /Edg/i } }, then: 'Edge' },
                { case: { $regexMatch: { input: '$browser', regex: /Chrome/i } }, then: 'Chrome' },
                { case: { $regexMatch: { input: '$browser', regex: /Safari/i } }, then: 'Safari' },
              ],
              default: 'Other',
            },
          },
        },
      },
      { $group: { _id: '$browserName', count: { $sum: 1 } } },
      { $project: { _id: 0, browser: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]),

    buildScanTrend(match, since),
    buildHourlyHeatmap(match, since),
    ScanEvent.aggregate([
      { $match: { ...match, scannedAt: { $gte: since } } },
      {
        $group: {
          _id: {
            country: { $ifNull: ['$country', 'Unknown'] },
            region: { $ifNull: ['$region', 'Unknown'] },
            city: { $ifNull: ['$city', 'Unknown'] },
            geoSource: { $ifNull: ['$geoSource', 'ip'] },
          },
          scans: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorHash' },
        },
      },
      { $sort: { scans: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          country: '$_id.country',
          region: '$_id.region',
          city: '$_id.city',
          geoSource: '$_id.geoSource',
          scans: 1,
          uniqueVisitors: { $size: '$uniqueVisitors' },
        },
      },
    ]),
  ]);

  const allTime = totals[0]?.allTime[0] || {
    totalScans: 0, uniqueVisitors: 0, avgSessionDuration: 0, avgVideoWatchPercent: 0,
  };
  const periodStats = totals[0]?.period[0] || { scans: 0, uniqueVisitors: 0 };

  let multiLinkAnalytics = null;
  if (campaign.campaignType === 'multiple-links-qr') {
    const clickMatch = { campaignId: cid };
    const clickMatchPeriod = { campaignId: cid, clickedAt: { $gte: since } };

    const [clicksByLinkPeriod, clicksByLinkAllTime, clickTrend] = await Promise.all([
      LinkClickEvent.aggregate([
        { $match: clickMatchPeriod },
        { $group: { _id: '$linkId', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $project: { _id: 0, linkId: '$_id', clicks: 1 } },
      ]),
      LinkClickEvent.aggregate([
        { $match: clickMatch },
        { $group: { _id: '$linkId', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $project: { _id: 0, linkId: '$_id', clicks: 1 } },
      ]),
      LinkClickEvent.aggregate([
        { $match: clickMatchPeriod },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
            clicks: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', clicks: 1 } },
      ]),
    ]);

    const attachLabels = (rows) =>
      rows.map((r) => ({
        ...r,
        label: linkLabelMap[r.linkId] || r.linkId,
      }));

    multiLinkAnalytics = {
      clicksByLinkPeriod: attachLabels(clicksByLinkPeriod),
      clicksByLinkAllTime: attachLabels(clicksByLinkAllTime),
      clickTrend,
    };
  }

  return success(res, {
    campaign: {
      _id:          campaign._id,
      campaignName: campaign.campaignName,
      status:       campaign.status,
      campaignType: campaign.campaignType,
    },
    period: `${days}d`,
    allTime,
    periodStats,
    deviceBreakdown,
    browserBreakdown,
    scanTrend,
    hourlyHeatmap,
    locationBreakdown,
    multiLinkAnalytics,
  });
};

// ---------------------------------------------------------------------------
// GET /api/analytics/trends
// ---------------------------------------------------------------------------
exports.getTrends = async (req, res) => {
  const days  = periodDays(req.query.period);
  const since = daysAgo(days);
  const uid   = new mongoose.Types.ObjectId(req.user._id);

  const scanTrend = await buildScanTrend({ userId: uid }, since);
  return success(res, { period: `${days}d`, scanTrend });
};
