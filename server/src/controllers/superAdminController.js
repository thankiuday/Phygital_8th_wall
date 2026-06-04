'use strict';

/**
 * superAdminController.js — analytics, extended user management, coupons.
 * All routes mounted under /api/admin with protect + authorize('admin').
 */

const User = require('../models/User');
const Session = require('../models/Session');
const Campaign = require('../models/Campaign');
const ScanEvent = require('../models/ScanEvent');
const LinkClickEvent = require('../models/LinkClickEvent');
const VideoPlayEvent = require('../models/VideoPlayEvent');
const Coupon = require('../models/Coupon');
const { PHYGITALIZE_CODE_PREFIX } = require('../services/billingWebhookService');
const { success, created } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ─── Analytics ────────────────────────────────────────────────────────────────

exports.getPlatformKPIs = async (_req, res) => {
  const [
    totalUsers,
    activeUsers,
    newUsers7d,
    newUsers30d,
    totalCampaigns,
    activeCampaigns,
    draftCampaigns,
    totalScans,
    scans7d,
    scans30d,
    totalLinkClicks,
    totalVideoPlays,
    couponsActive,
    couponsUsed,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
    User.countDocuments({ createdAt: { $gte: daysAgo(30) } }),
    Campaign.countDocuments({ isDeleted: { $ne: true } }),
    Campaign.countDocuments({ status: 'active', isDeleted: { $ne: true } }),
    Campaign.countDocuments({ status: 'draft', isDeleted: { $ne: true } }),
    ScanEvent.countDocuments(),
    ScanEvent.countDocuments({ scannedAt: { $gte: daysAgo(7) } }),
    ScanEvent.countDocuments({ scannedAt: { $gte: daysAgo(30) } }),
    LinkClickEvent.countDocuments().catch(() => 0),
    VideoPlayEvent.countDocuments().catch(() => 0),
    Coupon.countDocuments({ isActive: true }),
    Coupon.aggregate([{ $group: { _id: null, total: { $sum: '$usedCount' } } }]).then(
      (r) => r[0]?.total || 0
    ),
  ]);

  return success(res, {
    users: { total: totalUsers, active: activeUsers, new7d: newUsers7d, new30d: newUsers30d },
    campaigns: { total: totalCampaigns, active: activeCampaigns, draft: draftCampaigns },
    scans: { total: totalScans, last7d: scans7d, last30d: scans30d },
    engagement: { linkClicks: totalLinkClicks, videoPlays: totalVideoPlays },
    coupons: { active: couponsActive, totalRedemptions: couponsUsed },
  });
};

exports.getSignupsTrend = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const since = daysAgo(days);

  const trend = await User.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, date: '$_id', count: 1 } },
    { $sort: { date: 1 } },
  ]);

  return success(res, { days, trend });
};

exports.getScansTrend = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const since = daysAgo(days);

  const trend = await ScanEvent.aggregate([
    { $match: { scannedAt: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$scannedAt' } },
        scans: { $sum: 1 },
        unique: { $addToSet: '$visitorHash' },
      },
    },
    { $project: { _id: 0, date: '$_id', scans: 1, uniqueScans: { $size: '$unique' } } },
    { $sort: { date: 1 } },
  ]);

  return success(res, { days, trend });
};

exports.getCampaignTypeBreakdown = async (_req, res) => {
  const breakdown = await Campaign.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    {
      $group: {
        _id: '$campaignType',
        count: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
      },
    },
    { $project: { _id: 0, type: '$_id', count: 1, active: 1 } },
    { $sort: { count: -1 } },
  ]);
  return success(res, { breakdown });
};

exports.getDeviceBreakdown = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const devices = await ScanEvent.aggregate([
    { $match: { scannedAt: { $gte: daysAgo(days) } } },
    { $group: { _id: '$deviceType', count: { $sum: 1 } } },
    { $project: { _id: 0, device: { $ifNull: ['$_id', 'unknown'] }, count: 1 } },
    { $sort: { count: -1 } },
  ]);
  return success(res, { days, devices });
};

exports.getGeoBreakdown = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const countries = await ScanEvent.aggregate([
    {
      $match: {
        scannedAt: { $gte: daysAgo(days) },
        country: { $nin: [null, ''] },
      },
    },
    { $group: { _id: '$country', count: { $sum: 1 } } },
    { $project: { _id: 0, country: '$_id', count: 1 } },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ]);
  return success(res, { days, countries });
};

exports.getTopCampaigns = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const campaigns = await ScanEvent.aggregate([
    { $match: { scannedAt: { $gte: daysAgo(days) } } },
    {
      $group: {
        _id: '$campaignId',
        scans: { $sum: 1 },
        unique: { $addToSet: '$visitorHash' },
      },
    },
    { $sort: { scans: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'campaigns',
        localField: '_id',
        foreignField: '_id',
        as: 'campaign',
      },
    },
    { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'users',
        localField: 'campaign.userId',
        foreignField: '_id',
        as: 'owner',
      },
    },
    { $unwind: { path: '$owner', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        campaignId: '$_id',
        campaignName: '$campaign.campaignName',
        campaignType: '$campaign.campaignType',
        ownerEmail: '$owner.email',
        ownerName: '$owner.name',
        scans: 1,
        uniqueScans: { $size: '$unique' },
      },
    },
  ]);
  return success(res, { days, campaigns });
};

exports.getEngagementStats = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const since = daysAgo(days);

  const [stats] = await ScanEvent.aggregate([
    { $match: { scannedAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        totalScans: { $sum: 1 },
        avgSessionMs: { $avg: '$sessionDurationMs' },
        videoPlayCount: { $sum: { $cond: ['$videoPlayed', 1, 0] } },
        avgWatchSec: { $avg: '$videoWatchedSec' },
        avgWatchPct: { $avg: '$videoWatchPercent' },
      },
    },
  ]);

  const totalScans = stats?.totalScans || 0;
  const videoPlayCount = stats?.videoPlayCount || 0;

  return success(res, {
    days,
    avgSessionSeconds: Math.round((stats?.avgSessionMs || 0) / 1000),
    videoPlayRate:
      totalScans > 0 ? Number(((videoPlayCount / totalScans) * 100).toFixed(1)) : 0,
    avgVideoWatchSeconds: Math.round(stats?.avgWatchSec || 0),
    avgVideoWatchPercent: Math.round(stats?.avgWatchPct || 0),
  });
};

exports.getRetentionBreakdown = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const data = await ScanEvent.aggregate([
    {
      $match: {
        scannedAt: { $gte: daysAgo(days) },
        visitorHash: { $nin: [null, ''] },
      },
    },
    { $group: { _id: '$visitorHash', visits: { $sum: 1 } } },
    {
      $group: {
        _id: null,
        newVisitors: { $sum: { $cond: [{ $eq: ['$visits', 1] }, 1, 0] } },
        returningVisitors: { $sum: { $cond: [{ $gt: ['$visits', 1] }, 1, 0] } },
      },
    },
  ]);

  const result = data[0] || { newVisitors: 0, returningVisitors: 0 };
  return success(res, { days, ...result });
};

exports.getHourlyHeatmap = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 30, 90);
  const heatmap = await ScanEvent.aggregate([
    { $match: { scannedAt: { $gte: daysAgo(days) } } },
    {
      $group: {
        _id: {
          hour: { $hour: '$scannedAt' },
          dayOfWeek: { $dayOfWeek: '$scannedAt' },
        },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, hour: '$_id.hour', dayOfWeek: '$_id.dayOfWeek', count: 1 } },
  ]);
  return success(res, { days, heatmap });
};

// ─── Extended user management ─────────────────────────────────────────────────

exports.getUserDetail = async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password -passwordResetToken -passwordResetExpires')
    .lean();
  if (!user) throw new AppError('User not found', 404);

  const [campaigns, totalScans, recentScans] = await Promise.all([
    Campaign.find({ userId: user._id, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    ScanEvent.countDocuments({ userId: user._id }),
    ScanEvent.find({ userId: user._id }).sort({ scannedAt: -1 }).limit(10).lean(),
  ]);

  return success(res, {
    user,
    passwordMeta: {
      provider: user.authProvider || 'local',
      hasPassword: user.authProvider === 'google' ? false : true,
    },
    campaigns,
    totalScans,
    recentScans,
  });
};

exports.deleteUser = async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    throw new AppError('Cannot delete yourself', 400);
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  const campaignIds = (
    await Campaign.find({ userId: user._id }).select('_id').lean()
  ).map((c) => c._id);

  await Promise.all([
    Campaign.deleteMany({ userId: user._id }),
    ScanEvent.deleteMany({ userId: user._id }),
    campaignIds.length
      ? ScanEvent.deleteMany({ campaignId: { $in: campaignIds } })
      : Promise.resolve(),
    LinkClickEvent.deleteMany({ userId: user._id }),
    VideoPlayEvent.deleteMany({ userId: user._id }),
    Session.deleteMany({ user: user._id }),
    user.deleteOne(),
  ]);

  return success(res, null, 'User and all associated data deleted');
};

exports.adminResetPassword = async (req, res) => {
  const { newPassword } = req.body;

  const user = await User.findById(req.params.id).select('+password');
  if (!user) throw new AppError('User not found', 404);

  user.password = newPassword;
  await user.save({ validateModifiedOnly: true });

  const safe = await User.findById(user._id).select(
    '-password -passwordResetToken -passwordResetExpires'
  );

  return success(res, { user: safe }, 'Password reset successfully');
};

// ─── Campaign detail (admin insights) ───────────────────────────────────────

exports.getCampaignDetail = async (req, res) => {
  const campaign = await Campaign.findById(req.params.id)
    .populate('userId', 'name email')
    .lean();
  if (!campaign) throw new AppError('Campaign not found', 404);

  const since30 = daysAgo(30);
  const campaignId = campaign._id;

  const [allTime, last30d, geoTop, recentScans] = await Promise.all([
    ScanEvent.aggregate([
      { $match: { campaignId } },
      {
        $group: {
          _id: null,
          scans: { $sum: 1 },
          unique: { $addToSet: '$visitorHash' },
        },
      },
      {
        $project: {
          _id: 0,
          scans: 1,
          uniqueScans: { $size: '$unique' },
        },
      },
    ]),
    ScanEvent.aggregate([
      { $match: { campaignId, scannedAt: { $gte: since30 } } },
      {
        $group: {
          _id: null,
          scans: { $sum: 1 },
          unique: { $addToSet: '$visitorHash' },
        },
      },
      {
        $project: {
          _id: 0,
          scans: 1,
          uniqueScans: { $size: '$unique' },
        },
      },
    ]),
    ScanEvent.aggregate([
      { $match: { campaignId, country: { $nin: [null, ''] } } },
      { $group: { _id: '$country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, country: '$_id', count: 1 } },
    ]),
    ScanEvent.find({ campaignId })
      .sort({ scannedAt: -1 })
      .limit(10)
      .select('scannedAt deviceType browser country touchpoint videoPlayed sessionDurationMs')
      .lean(),
  ]);

  return success(res, {
    campaign,
    owner: campaign.userId,
    scans: {
      allTime: allTime[0] || { scans: 0, uniqueScans: 0 },
      last30d: last30d[0] || { scans: 0, uniqueScans: 0 },
    },
    geoTop,
    recentScans,
    analytics: campaign.analytics || {},
  });
};

// ─── Coupon management ────────────────────────────────────────────────────────

const parseExpiresAt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const d = new Date(`${value}T23:59:59.999Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

exports.listCoupons = async (req, res) => {
  const { page = 1, limit = 20, search = '', active } = req.query;
  const filter = {};
  if (search.trim()) filter.code = { $regex: search.trim().toUpperCase(), $options: 'i' };
  if (active === 'true') filter.isActive = true;
  if (active === 'false') filter.isActive = false;

  const skip = (Number(page) - 1) * Number(limit);
  const [coupons, total] = await Promise.all([
    Coupon.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Coupon.countDocuments(filter),
  ]);

  return success(res, {
    coupons,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
  });
};

exports.createCoupon = async (req, res) => {
  const { code, description, benefit, maxUses, expiresAt } = req.body;

  const normalized = code.trim().toUpperCase();
  if (PHYGITALIZE_CODE_PREFIX.test(normalized)) {
    throw new AppError(
      'PHYGITALIZE codes are managed in Stripe for paid subscriptions, not admin coupons',
      400
    );
  }
  const exists = await Coupon.findOne({ code: normalized });
  if (exists) throw new AppError('Coupon code already exists', 409);

  const coupon = await Coupon.create({
    code: normalized,
    description: description || '',
    benefit: benefit || 'full_access',
    maxUses: maxUses || 1,
    expiresAt: parseExpiresAt(expiresAt),
    createdBy: req.user._id,
  });

  return created(res, { coupon }, 'Coupon created');
};

exports.updateCoupon = async (req, res) => {
  const { isActive, description, maxUses, expiresAt } = req.body;
  const update = {};
  if (isActive !== undefined) update.isActive = Boolean(isActive);
  if (description !== undefined) update.description = description;
  if (maxUses !== undefined) update.maxUses = Number(maxUses);
  if (expiresAt !== undefined) update.expiresAt = parseExpiresAt(expiresAt);

  const coupon = await Coupon.findByIdAndUpdate(req.params.id, update, { new: true })
    .populate('createdBy', 'name email');
  if (!coupon) throw new AppError('Coupon not found', 404);

  return success(res, { coupon }, 'Coupon updated');
};

exports.deleteCoupon = async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new AppError('Coupon not found', 404);
  return success(res, null, 'Coupon deleted');
};
