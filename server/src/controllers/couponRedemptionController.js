'use strict';

/**
 * couponRedemptionController.js — authenticated user redeems a coupon code.
 */

const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { success } = require('../utils/apiResponse');
const { AppError } = require('../middleware/errorHandler');

exports.redeemCoupon = async (req, res) => {
  const { code } = req.body;
  const normalized = code.trim().toUpperCase();

  const coupon = await Coupon.findOne({ code: normalized, isActive: true });
  if (!coupon) throw new AppError('Invalid or inactive coupon code', 404);

  if (coupon.expiresAt && coupon.expiresAt < new Date()) {
    throw new AppError('This coupon has expired', 400);
  }

  if (coupon.usedCount >= coupon.maxUses) {
    throw new AppError('This coupon has reached its maximum usage limit', 400);
  }

  const alreadyRedeemed = coupon.redemptions.some(
    (r) => r.userId && r.userId.toString() === req.user._id.toString()
  );
  if (alreadyRedeemed) {
    throw new AppError('You have already redeemed this coupon', 400);
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);
  if (user.hasFullAccess) {
    throw new AppError('Your account already has full access', 400);
  }

  const now = new Date();
  const updatedCoupon = await Coupon.findOneAndUpdate(
    {
      _id: coupon._id,
      isActive: true,
      usedCount: { $lt: coupon.maxUses },
      $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
      'redemptions.userId': { $ne: req.user._id },
    },
    {
      $inc: { usedCount: 1 },
      $push: { redemptions: { userId: req.user._id, redeemedAt: now } },
    },
    { new: true }
  );

  if (!updatedCoupon) {
    throw new AppError('Coupon is no longer available', 400);
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      hasFullAccess: true,
      couponRedeemed: coupon.code,
      fullAccessGrantedAt: now,
    },
    { new: true }
  ).select('-password -passwordResetToken -passwordResetExpires');

  return success(res, {
    hasFullAccess: true,
    benefit: coupon.benefit,
    user: {
      _id: updatedUser._id,
      hasFullAccess: updatedUser.hasFullAccess,
      couponRedeemed: updatedUser.couponRedeemed,
      fullAccessGrantedAt: updatedUser.fullAccessGrantedAt,
    },
    message: 'Coupon redeemed successfully! Full access unlocked.',
  });
};
