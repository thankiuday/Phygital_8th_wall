'use strict';

const AnalyticsDailyRollup = require('../models/AnalyticsDailyRollup');

const VISITOR_HASH_CAP = 2000;

/**
 * Best-effort daily rollups for scan trends (UTC buckets). Never throws —
 * failures are logged by callers if needed.
 */
exports.bumpRollupsForScan = async (scanDoc) => {
  if (!scanDoc?.userId || !scanDoc?.scannedAt) return;
  const dateUtc = new Date(scanDoc.scannedAt).toISOString().slice(0, 10);
  const visitorHash =
    typeof scanDoc.visitorHash === 'string' && scanDoc.visitorHash.trim()
      ? scanDoc.visitorHash.trim().slice(0, 128)
      : 'unknown';

  const bumpPipeline = (rollupScope, extraMatch) => [
    { $set: { rollupScope, dateUtc, ...extraMatch } },
    {
      $set: {
        scans: { $add: [{ $ifNull: ['$scans', 0] }, 1] },
        visitorHashes: {
          $slice: [
            {
              $setUnion: [
                { $ifNull: ['$visitorHashes', []] },
                [visitorHash],
              ],
            },
            VISITOR_HASH_CAP,
          ],
        },
      },
    },
    { $set: { uniqueScansApprox: { $size: '$visitorHashes' } } },
  ];

  const userId = scanDoc.userId;
  const campaignId = scanDoc.campaignId;

  await Promise.all([
    AnalyticsDailyRollup.updateOne(
      { rollupScope: 'user', userId, dateUtc },
      bumpPipeline('user', { userId, campaignId: null }),
      { upsert: true }
    ),
    AnalyticsDailyRollup.updateOne(
      { rollupScope: 'campaign', campaignId, dateUtc },
      bumpPipeline('campaign', { userId, campaignId }),
      { upsert: true }
    ),
  ]);
};

/**
 * @param {{ userId?: import('mongoose').Types.ObjectId, campaignId?: import('mongoose').Types.ObjectId }} match
 * @param {Date} since
 * @param {(rows: Array<{date: string, scans: number, uniqueScans: number}>) => unknown} fillDailySeriesFn
 */
exports.tryUtcRollupScanTrend = async (match, since, fillDailySeriesFn) => {
  const minDate = since.toISOString().slice(0, 10);
  const maxDate = new Date().toISOString().slice(0, 10);

  let filter;
  if (match.campaignId) {
    filter = {
      rollupScope: 'campaign',
      campaignId: match.campaignId,
      dateUtc: { $gte: minDate, $lte: maxDate },
    };
  } else if (match.userId) {
    filter = {
      rollupScope: 'user',
      userId: match.userId,
      dateUtc: { $gte: minDate, $lte: maxDate },
    };
  } else {
    return null;
  }

  const rows = await AnalyticsDailyRollup.find(filter).sort({ dateUtc: 1 }).lean();
  if (!rows.length) return null;

  const expectedApproxDays = Math.max(1, Math.ceil((Date.now() - since.getTime()) / 86400000));
  if (rows.length < Math.min(3, expectedApproxDays)) return null;

  const mapped = rows.map((r) => ({
    date: r.dateUtc,
    scans: r.scans || 0,
    uniqueScans: r.uniqueScansApprox ?? (Array.isArray(r.visitorHashes) ? r.visitorHashes.length : 0),
  }));
  return fillDailySeriesFn(mapped);
};
