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
const VideoPlayEvent = require('../models/VideoPlayEvent');
const Campaign  = require('../models/Campaign');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

/** Hub types (multi-link, links-video, links-doc-video) — outbound link tap aggregates apply. */
const MULTI_LINK_TYPES = new Set([
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
]);

/** Hub types that surface a hero-style watch funnel rolled up across all videos. */
const VIDEO_HUB_TYPES = new Set(['links-video-qr', 'links-doc-video-qr']);

/** Card-style types — different telemetry surface (action breakdowns, prints). */
const CARD_TYPES = new Set(['digital-business-card']);

/** Recognized card-action keys; should mirror `cardActionQueue.ALLOWED_ACTIONS`. */
const CARD_ACTION_KEYS = [
  'call', 'email', 'whatsapp', 'website', 'social',
  'galleryView', 'videoPlay', 'docOpen', 'cta', 'print-download',
];

const DEFAULT_ANALYTICS_TZ = process.env.ANALYTICS_TIMEZONE || 'UTC';
const normalizeTimeZone = (tz) => {
  if (typeof tz !== 'string' || !tz.trim()) return DEFAULT_ANALYTICS_TZ;
  const value = tz.trim();
  try {
    // Validate IANA timezone.
    Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return DEFAULT_ANALYTICS_TZ;
  }
};

const formatDateInTz = (date, timeZone) => new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(date);

const fillDailySeries = (rows, since, timeZone, valueKeys) => {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const result = [];
  const cursor = new Date(since);
  const end = new Date();
  while (cursor <= end) {
    const key = formatDateInTz(cursor, timeZone);
    const found = byDate.get(key);
    if (found) {
      result.push(found);
    } else {
      const zeroRow = { date: key };
      for (const valueKey of valueKeys) zeroRow[valueKey] = 0;
      result.push(zeroRow);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
};

const browserNameProjectStage = {
  $addFields: {
    browserName: {
      $switch: {
        branches: [
          { case: { $regexMatch: { input: '$browser', regex: /SamsungBrowser/i } }, then: 'Samsung' },
          { case: { $regexMatch: { input: '$browser', regex: /OPR|Opera/i } }, then: 'Opera' },
          { case: { $regexMatch: { input: '$browser', regex: /Firefox/i } }, then: 'Firefox' },
          { case: { $regexMatch: { input: '$browser', regex: /Edg|Edge/i } }, then: 'Edge' },
          { case: { $regexMatch: { input: '$browser', regex: /CriOS|Chrome/i } }, then: 'Chrome' },
          { case: { $regexMatch: { input: '$browser', regex: /Safari/i } }, then: 'Safari' },
          { case: { $regexMatch: { input: '$browser', regex: /FBAN|FBAV|Instagram|Threads/i } }, then: 'In-App Browser' },
        ],
        default: 'Other',
      },
    },
  },
};

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
const buildScanTrend = async (matchStage, since, timeZone) => {
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
          $dateToString: { format: '%Y-%m-%d', date: '$scannedAt', timezone: timeZone },
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

  return fillDailySeries(trend, since, timeZone, ['scans', 'uniqueScans']);
};

/**
 * buildHourlyHeatmap — counts scans for each hour of the day (0–23).
 */
const buildHourlyHeatmap = async (matchStage, since, timeZone) => {
  const raw = await ScanEvent.aggregate([
    { $match: { ...matchStage, scannedAt: { $gte: since } } },
    {
      $group: {
        _id: { $hour: { date: '$scannedAt', timezone: timeZone } },
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
  const timeZone = normalizeTimeZone(req.query.timezone);

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
      browserNameProjectStage,
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
    buildScanTrend(match, since, timeZone),

    // ── Hourly heatmap ─────────────────────────────────────────────────────
    buildHourlyHeatmap(match, since, timeZone),
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
  const timeZone = normalizeTimeZone(req.query.timezone);

  // Verify the campaign belongs to this user
  const campaign = await Campaign.findOne(
    { _id: cid, userId: uid },
    'campaignName status analytics campaignType linkItems videoItems docItems'
  ).lean();
  if (!campaign) throw new AppError('Campaign not found', 404);

  const match = { campaignId: cid };

  const linkLabelMap = Object.fromEntries(
    (campaign.linkItems || []).map((it) => [it.linkId, it.label])
  );
  const docLabelMap = Object.fromEntries(
    (campaign.docItems || []).map((it) => [it.docId, it.label])
  );
  const videoLabelMap = Object.fromEntries(
    (campaign.videoItems || []).map((it) => [it.videoId, it.label])
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
      browserNameProjectStage,
      { $group: { _id: '$browserName', count: { $sum: 1 } } },
      { $project: { _id: 0, browser: '$_id', count: 1 } },
      { $sort: { count: -1 } },
    ]),

    buildScanTrend(match, since, timeZone),
    buildHourlyHeatmap(match, since, timeZone),
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
  if (MULTI_LINK_TYPES.has(campaign.campaignType)) {
    // Outbound-link aggregates only — `kind: 'document'` rows belong to the
    // separate documents block. We default to `'link'` (or null/missing) so
    // pre-migration rows still show up in totals.
    const linkKindFilter = { $in: ['link', null] };
    const clickMatch = { campaignId: cid, kind: linkKindFilter };
    const clickMatchPeriod = {
      campaignId: cid,
      kind: linkKindFilter,
      clickedAt: { $gte: since },
    };

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
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt', timezone: timeZone } },
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
      clickTrend: fillDailySeries(clickTrend, since, timeZone, ['clicks']),
    };
  }

  let videoAnalytics = null;
  if (VIDEO_HUB_TYPES.has(campaign.campaignType)) {
    const usesPerAssetVideoTelemetry = campaign.campaignType === 'links-doc-video-qr';
    const videoEventModel = usesPerAssetVideoTelemetry ? VideoPlayEvent : ScanEvent;
    const dateField = usesPerAssetVideoTelemetry ? 'occurredAt' : 'scannedAt';
    const watchPercentField = usesPerAssetVideoTelemetry ? '$watchPercent' : '$videoWatchPercent';
    const watchSecField = usesPerAssetVideoTelemetry ? '$watchedSec' : '$videoWatchedSec';
    const baseVideoMatch = usesPerAssetVideoTelemetry
      ? { campaignId: cid }
      : { ...match, videoPlayed: true };
    const periodVideoMatch = {
      ...baseVideoMatch,
      [dateField]: { $gte: since },
    };

    const [videoPeriodAgg, watchBucketsAgg, watchTrend] = await Promise.all([
      videoEventModel.aggregate([
        { $match: periodVideoMatch },
        {
          $group: {
            _id: null,
            plays: { $addToSet: { $ifNull: ['$visitorHash', null] } },
            completions: {
              $addToSet: {
                $cond: [
                  { $gte: [watchPercentField, 95] },
                  { $ifNull: ['$visitorHash', null] },
                  '$$REMOVE',
                ],
              },
            },
            avgWatchPercent: { $avg: watchPercentField },
            avgWatchSec: { $avg: watchSecField },
          },
        },
        {
          $project: {
            _id: 0,
            totalPlaysPeriod: { $size: '$plays' },
            totalCompletionsPeriod: { $size: '$completions' },
            avgWatchPercent: {
              $cond: [
                { $gt: [{ $size: '$plays' }, 0] },
                { $round: [{ $ifNull: ['$avgWatchPercent', 0] }, 1] },
                null,
              ],
            },
            avgWatchSec: {
              $cond: [
                { $gt: [{ $size: '$plays' }, 0] },
                { $round: [{ $ifNull: ['$avgWatchSec', 0] }, 0] },
                null,
              ],
            },
          },
        },
      ]),
      videoEventModel.aggregate([
        { $match: periodVideoMatch },
        {
          $bucket: {
            groupBy: watchPercentField,
            boundaries: [0, 25, 50, 75, 95, 101],
            default: 'other',
            output: { visitors: { $addToSet: '$visitorHash' } },
          },
        },
      ]),
      videoEventModel.aggregate([
        { $match: periodVideoMatch },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: `$${dateField}`,
                timezone: timeZone,
              },
            },
            plays: { $sum: 1 },
            completions: { $sum: { $cond: [{ $gte: [watchPercentField, 95] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', plays: 1, completions: 1 } },
      ]),
    ]);

    const periodRow = videoPeriodAgg[0] || {
      totalPlaysPeriod: 0,
      totalCompletionsPeriod: 0,
      avgWatchPercent: 0,
      avgWatchSec: 0,
    };

    const totalPlaysAllTime = await videoEventModel.aggregate([
      { $match: baseVideoMatch },
      { $group: { _id: '$visitorHash' } },
      { $count: 'count' },
    ]);

    const bucketMap = new Map(
      watchBucketsAgg
        .filter((b) => b._id !== 'other')
        .map((b) => [String(b._id), Array.isArray(b.visitors) ? b.visitors.filter(Boolean).length : 0])
    );

    const watchPercentBuckets = [
      { bucket: 'started', visitors: periodRow.totalPlaysPeriod || 0 },
      { bucket: '25%', visitors: bucketMap.get('25') || 0 },
      { bucket: '50%', visitors: bucketMap.get('50') || 0 },
      { bucket: '75%', visitors: bucketMap.get('75') || 0 },
      { bucket: 'completed', visitors: bucketMap.get('95') || 0 },
    ];

    const scansDenominator = periodStats.scans || 0;
    const playRatePeriod = scansDenominator > 0
      ? Number(((periodRow.totalPlaysPeriod / scansDenominator) * 100).toFixed(1))
      : null;

    videoAnalytics = {
      playRatePeriod,
      totalPlaysAllTime: totalPlaysAllTime[0]?.count || 0,
      totalPlaysPeriod: periodRow.totalPlaysPeriod || 0,
      totalCompletionsPeriod: periodRow.totalCompletionsPeriod || 0,
      avgWatchPercent: periodRow.avgWatchPercent ?? null,
      avgWatchSec: periodRow.avgWatchSec ?? null,
      watchPercentBuckets,
      watchTrend: fillDailySeries(watchTrend, since, timeZone, ['plays', 'completions']),
    };
  }

  // Per-asset analytics (links-doc-video-qr) — top docs / videos plus daily trends.
  let assetAnalytics = null;
  if (campaign.campaignType === 'links-doc-video-qr') {
    const docMatchAll = { campaignId: cid, kind: 'document' };
    const docMatchPeriod = { ...docMatchAll, clickedAt: { $gte: since } };
    const playMatchAll = { campaignId: cid };
    const playMatchPeriod = { ...playMatchAll, occurredAt: { $gte: since } };

    const [
      docOpensByAssetPeriod,
      docOpensByAssetAllTime,
      docOpenTrend,
      videoPlaysByAssetPeriod,
      videoPlaysByAssetAllTime,
      videoPlayTrend,
    ] = await Promise.all([
      LinkClickEvent.aggregate([
        { $match: docMatchPeriod },
        { $group: { _id: '$linkId', opens: { $sum: 1 } } },
        { $sort: { opens: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, docId: '$_id', opens: 1 } },
      ]),
      LinkClickEvent.aggregate([
        { $match: docMatchAll },
        { $group: { _id: '$linkId', opens: { $sum: 1 } } },
        { $sort: { opens: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, docId: '$_id', opens: 1 } },
      ]),
      LinkClickEvent.aggregate([
        { $match: docMatchPeriod },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt', timezone: timeZone } },
            opens: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', opens: 1 } },
      ]),
      VideoPlayEvent.aggregate([
        { $match: playMatchPeriod },
        { $group: { _id: '$videoId', plays: { $sum: 1 } } },
        { $sort: { plays: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, videoId: '$_id', plays: 1 } },
      ]),
      VideoPlayEvent.aggregate([
        { $match: playMatchAll },
        { $group: { _id: '$videoId', plays: { $sum: 1 } } },
        { $sort: { plays: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, videoId: '$_id', plays: 1 } },
      ]),
      VideoPlayEvent.aggregate([
        { $match: playMatchPeriod },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$occurredAt', timezone: timeZone } },
            plays: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', plays: 1 } },
      ]),
    ]);

    const attachDocLabel = (rows) =>
      rows.map((r) => ({ ...r, label: docLabelMap[r.docId] || r.docId }));
    const attachVideoLabel = (rows) =>
      rows.map((r) => ({ ...r, label: videoLabelMap[r.videoId] || r.videoId }));

    const totalDocOpensPeriod = docOpensByAssetPeriod.reduce(
      (sum, r) => sum + (r.opens || 0),
      0
    );
    const totalVideoPlaysPeriod = videoPlaysByAssetPeriod.reduce(
      (sum, r) => sum + (r.plays || 0),
      0
    );

    assetAnalytics = {
      docOpensByAssetPeriod: attachDocLabel(docOpensByAssetPeriod),
      docOpensByAssetAllTime: attachDocLabel(docOpensByAssetAllTime),
      docOpenTrend: fillDailySeries(docOpenTrend, since, timeZone, ['opens']),
      videoPlaysByAssetPeriod: attachVideoLabel(videoPlaysByAssetPeriod),
      videoPlaysByAssetAllTime: attachVideoLabel(videoPlaysByAssetAllTime),
      videoPlayTrend: fillDailySeries(videoPlayTrend, since, timeZone, ['plays']),
      totalDocOpensPeriod,
      totalVideoPlaysPeriod,
    };
  }

  /* Per-type analytics for digital-business-card.
   * Action telemetry is stored in `LinkClickEvent` with a `linkId` shaped as
   * `<action>:<target>` (or just `<action>` when no target). We split the
   * id back out here so the dashboard can show top channels and per-network
   * social breakdowns without a separate event collection. */
  let cardAnalytics = null;
  if (CARD_TYPES.has(campaign.campaignType)) {
    const cardMatch = { campaignId: cid };
    const cardMatchPeriod = { ...cardMatch, clickedAt: { $gte: since } };

    const [actionRowsPeriod, actionRowsAllTime, actionTrend] = await Promise.all([
      LinkClickEvent.aggregate([
        { $match: cardMatchPeriod },
        { $group: { _id: '$linkId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      LinkClickEvent.aggregate([
        { $match: cardMatch },
        { $group: { _id: '$linkId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      LinkClickEvent.aggregate([
        { $match: cardMatchPeriod },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt', timezone: timeZone } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
      ]),
    ]);

    const splitActionKey = (raw) => {
      const idx = String(raw).indexOf(':');
      if (idx === -1) return { action: String(raw), target: null };
      return { action: String(raw).slice(0, idx), target: String(raw).slice(idx + 1) };
    };

    const groupRows = (rows) => {
      const byAction = new Map();
      const targetsByAction = new Map();
      for (const r of rows) {
        const { action, target } = splitActionKey(r._id);
        byAction.set(action, (byAction.get(action) || 0) + r.count);
        if (target) {
          if (!targetsByAction.has(action)) targetsByAction.set(action, new Map());
          const tmap = targetsByAction.get(action);
          tmap.set(target, (tmap.get(target) || 0) + r.count);
        }
      }
      const ordered = CARD_ACTION_KEYS
        .map((key) => ({ action: key, count: byAction.get(key) || 0 }))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count);
      const targets = {};
      for (const [action, tmap] of targetsByAction.entries()) {
        targets[action] = Array.from(tmap.entries())
          .map(([target, count]) => ({ target, count }))
          .sort((a, b) => b.count - a.count);
      }
      return { actions: ordered, targets };
    };

    const periodGroup = groupRows(actionRowsPeriod);
    const allTimeGroup = groupRows(actionRowsAllTime);

    const actionTotalPeriod = periodGroup.actions.reduce((sum, r) => sum + r.count, 0);
    const printDownloads =
      periodGroup.actions.find((r) => r.action === 'print-download')?.count || 0;
    const printDownloadsAllTime =
      allTimeGroup.actions.find((r) => r.action === 'print-download')?.count || 0;

    const scansPeriodValue = periodStats?.scans || 0;
    const actionRatePeriod = scansPeriodValue > 0
      ? Number(((actionTotalPeriod / scansPeriodValue) * 100).toFixed(1))
      : null;

    cardAnalytics = {
      actionTotalsPeriod: periodGroup.actions,
      actionTotalsAllTime: allTimeGroup.actions,
      socialBreakdownPeriod: periodGroup.targets.social || [],
      ctaBreakdownPeriod: periodGroup.targets.cta || [],
      actionTrend: fillDailySeries(actionTrend, since, timeZone, ['count']),
      actionTotalPeriod,
      actionRatePeriod,
      printDownloads,
      printDownloadsAllTime,
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
    videoAnalytics,
    assetAnalytics,
    cardAnalytics,
  });
};

// ---------------------------------------------------------------------------
// GET /api/analytics/trends
// ---------------------------------------------------------------------------
exports.getTrends = async (req, res) => {
  const days  = periodDays(req.query.period);
  const since = daysAgo(days);
  const uid   = new mongoose.Types.ObjectId(req.user._id);
  const timeZone = normalizeTimeZone(req.query.timezone);

  const scanTrend = await buildScanTrend({ userId: uid }, since, timeZone);
  return success(res, { period: `${days}d`, scanTrend });
};
