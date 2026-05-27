'use strict';

const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');
const { success } = require('../utils/apiResponse');

exports.listNotifications = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const unreadOnly = req.query.unread === '1' || req.query.unread === 'true';

  const filter = { recipientId: req.user._id };
  if (unreadOnly) filter.readAt = null;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipientId: req.user._id, readAt: null }),
  ]);

  return success(res, { notifications, unreadCount });
};

exports.markNotificationRead = async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    recipientId: req.user._id,
  });

  if (!notification) throw new AppError('Notification not found', 404);

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }

  const unreadCount = await Notification.countDocuments({
    recipientId: req.user._id,
    readAt: null,
  });

  return success(res, { notification, unreadCount });
};

exports.markAllNotificationsRead = async (req, res) => {
  await Notification.updateMany(
    { recipientId: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );

  return success(res, { unreadCount: 0 });
};
