'use strict';

const Campaign = require('../models/Campaign');
const ScanEvent = require('../models/ScanEvent');
const { success } = require('../utils/apiResponse');

/**
 * GET /api/dashboard/stats
 * Returns all numbers needed to render the dashboard in one request.
 */
const getDashboardStats = async (req, res) => {
  const userId = req.user._id;
  const now = new Date();

  // Start of today (UTC)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // Start of this week (Monday)
  const weekStart = new Date(now);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() + 1);
  weekStart.setUTCHours(0, 0, 0, 0);

  // Run all aggregations in parallel for performance
  const [
    totalCampaigns,
    activeCampaigns,
    totalScansResult,
    todayScansResult,
    weeklyScansResult,
    recentCampaigns,
    scanTrend,
  ] = await Promise.all([
    // 1. Total campaigns owned by user
    Campaign.countDocuments({ userId, isDeleted: { $ne: true } }),

    // 2. Active campaigns
    Campaign.countDocuments({ userId, status: 'active', isDeleted: { $ne: true } }),

    // 3. Total lifetime scans across all user campaigns
    ScanEvent.countDocuments({ userId }),

    // 4. Scans today
    ScanEvent.countDocuments({ userId, scannedAt: { $gte: todayStart } }),

    // 5. Scans this week
    ScanEvent.countDocuments({ userId, scannedAt: { $gte: weekStart } }),

    // 6. 5 most recent campaigns with their scan counts
    Campaign.find({ userId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('campaignName status thumbnailUrl analytics createdAt')
      .lean(),

    // 7. Daily scan trend — last 7 days
    ScanEvent.aggregate([
      {
        $match: {
          userId,
          scannedAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  // Fill in any missing days in the trend with 0
  const trendMap = Object.fromEntries(scanTrend.map((d) => [d._id, d.count]));
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - (6 - i));
    const key = d.toISOString().split('T')[0];
    return { date: key, scans: trendMap[key] || 0 };
  });

  return success(res, {
    stats: {
      totalCampaigns,
      activeCampaigns,
      totalScans: totalScansResult,
      todayScans: todayScansResult,
      weekScans: weeklyScansResult,
    },
    recentCampaigns,
    scanTrend: trendData,
  });
};

module.exports = { getDashboardStats };
