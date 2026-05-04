'use strict';

/**
 * adminController.js
 *
 * All endpoints require role === 'admin' (enforced in adminRoutes.js via authorize middleware).
 *
 * Endpoints:
 *   GET    /api/admin/stats
 *   GET    /api/admin/users?search=&page=&limit=
 *   PATCH  /api/admin/users/:id
 *   GET    /api/admin/campaigns?search=&status=&page=&limit=
 *   PATCH  /api/admin/campaigns/:id
 */

const mongoose = require('mongoose');
const User      = require('../models/User');
const Session   = require('../models/Session');
const Campaign  = require('../models/Campaign');
const ScanEvent = require('../models/ScanEvent');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const startOfDay  = () => { const d = new Date(); d.setHours(0,0,0,0);  return d; };
const startOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  d.setHours(0,0,0,0);
  return d;
};

// ---------------------------------------------------------------------------
// GET /api/admin/stats — platform-wide overview
// ---------------------------------------------------------------------------
exports.getStats = async (_req, res) => {
  const [
    totalUsers,
    activeUsers,
    newUsersToday,
    newUsersThisWeek,
    totalCampaigns,
    activeCampaigns,
    totalScans,
    scansToday,
    topUsers,
    recentCampaigns,
    weeklySignups,
  ] = await Promise.all([
    // User counts
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ createdAt: { $gte: startOfDay() } }),
    User.countDocuments({ createdAt: { $gte: startOfWeek() } }),

    // Campaign counts
    Campaign.countDocuments(),
    Campaign.countDocuments({ status: 'active' }),

    // Scan counts
    ScanEvent.countDocuments(),
    ScanEvent.countDocuments({ scannedAt: { $gte: startOfDay() } }),

    // Top 5 users by total scans on their campaigns
    ScanEvent.aggregate([
      { $group: { _id: '$userId', totalScans: { $sum: 1 } } },
      { $sort: { totalScans: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: '$user._id',
          name: '$user.name',
          email: '$user.email',
          role: '$user.role',
          isActive: '$user.isActive',
          totalScans: 1,
        },
      },
    ]),

    // 5 most recent campaigns (across all users)
    Campaign.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email')
      .lean(),

    // Daily signup count for the last 7 days
    User.aggregate([
      { $match: { createdAt: { $gte: startOfWeek() } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } },
    ]),
  ]);

  return success(res, {
    users:     { total: totalUsers, active: activeUsers, newToday: newUsersToday, newThisWeek: newUsersThisWeek },
    campaigns: { total: totalCampaigns, active: activeCampaigns },
    scans:     { total: totalScans, today: scansToday },
    topUsers,
    recentCampaigns,
    weeklySignups,
  });
};

// ---------------------------------------------------------------------------
// GET /api/admin/users — paginated user list with campaign & scan counts
// ---------------------------------------------------------------------------
exports.getUsers = async (req, res) => {
  const { search = '', page = 1, limit = 20, role, status } = req.query;

  const filter = {};
  if (search.trim()) {
    filter.$or = [
      { name:  { $regex: search.trim(), $options: 'i' } },
      { email: { $regex: search.trim(), $options: 'i' } },
    ];
  }
  if (role && ['user', 'admin'].includes(role))       filter.role     = role;
  if (status === 'active')                             filter.isActive = true;
  if (status === 'suspended')                          filter.isActive = false;

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password -passwordResetToken -passwordResetExpires')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    User.countDocuments(filter),
  ]);

  // Attach campaign count + scan count per user (batch lookup)
  const userIds = users.map((u) => u._id);
  const [campaignCounts, scanCounts] = await Promise.all([
    Campaign.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
    ScanEvent.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]),
  ]);

  const campMap  = Object.fromEntries(campaignCounts.map((r) => [r._id.toString(), r.count]));
  const scanMap  = Object.fromEntries(scanCounts.map((r) => [r._id.toString(), r.count]));

  const enriched = users.map((u) => ({
    ...u,
    campaignCount: campMap[u._id.toString()] || 0,
    scanCount:     scanMap[u._id.toString()] || 0,
  }));

  return success(res, {
    users: enriched,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:id — suspend / activate / change role
// ---------------------------------------------------------------------------
exports.updateUser = async (req, res) => {
  const { isActive, role } = req.body;

  // Prevent admins from demoting themselves
  if (req.params.id === req.user._id.toString() && role === 'user') {
    throw new AppError('You cannot change your own role.', 400);
  }

  const allowed = {};
  if (isActive !== undefined) allowed.isActive = Boolean(isActive);
  if (role && ['user', 'admin'].includes(role)) allowed.role = role;

  if (Object.keys(allowed).length === 0) throw new AppError('No valid fields to update', 400);

  const user = await User.findByIdAndUpdate(req.params.id, allowed, { new: true })
    .select('-password -passwordResetToken -passwordResetExpires');
  if (!user) throw new AppError('User not found', 404);

  if (allowed.isActive === false) {
    await Session.deleteMany({ user: user._id });
  }

  return success(res, { user }, 'User updated');
};

// ---------------------------------------------------------------------------
// GET /api/admin/campaigns — all campaigns with owner info
// ---------------------------------------------------------------------------
exports.getCampaigns = async (req, res) => {
  const { search = '', status, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (search.trim()) {
    filter.campaignName = { $regex: search.trim(), $options: 'i' };
  }
  if (status && ['active', 'paused', 'draft'].includes(status)) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Campaign.countDocuments(filter),
  ]);

  return success(res, {
    campaigns,
    pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
  });
};

// ---------------------------------------------------------------------------
// PATCH /api/admin/campaigns/:id — pause / reactivate any campaign
// ---------------------------------------------------------------------------
exports.updateCampaign = async (req, res) => {
  const { status } = req.body;

  if (!status || !['active', 'paused', 'draft'].includes(status)) {
    throw new AppError('Valid status required: active | paused | draft', 400);
  }

  const campaign = await Campaign.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true }
  ).populate('userId', 'name email');

  if (!campaign) throw new AppError('Campaign not found', 404);

  return success(res, { campaign }, 'Campaign updated');
};
