'use strict';

/**
 * Lightweight E2E smoke test for coupon + analytics models (no HTTP).
 * Run: node scripts/test-super-admin-e2e.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const Coupon = require('../src/models/Coupon');

const CODE = `TEST-${Date.now()}`;

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  let testUser = await User.findOne({ role: 'user', email: /e2e-coupon-test/i });
  if (!testUser) {
    testUser = await User.create({
      name: 'E2E Coupon Test',
      email: `e2e-coupon-test-${Date.now()}@example.com`,
      password: 'TestPass1',
      role: 'user',
    });
    console.log('Created test user:', testUser.email);
  } else {
    await User.findByIdAndUpdate(testUser._id, {
      hasFullAccess: false,
      couponRedeemed: null,
      fullAccessGrantedAt: null,
    });
    testUser = await User.findById(testUser._id);
    console.log('Reset test user:', testUser.email);
  }

  let admin = await User.findOne({ role: 'admin' });
  const couponCreator = admin || testUser;
  if (!admin) {
    console.warn('No admin user — using test user as coupon creator for smoke test.');
  }

  if (couponCreator) {
    await Coupon.deleteOne({ code: CODE });
    const coupon = await Coupon.create({
      code: CODE,
      description: 'E2E test coupon',
      benefit: 'full_access',
      maxUses: 1,
      createdBy: couponCreator._id,
    });
    console.log('Created coupon:', coupon.code, 'isValid:', coupon.isValid);

    const now = new Date();
    const updatedCoupon = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        isActive: true,
        usedCount: { $lt: coupon.maxUses },
        $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }],
        'redemptions.userId': { $ne: testUser._id },
      },
      {
        $inc: { usedCount: 1 },
        $push: { redemptions: { userId: testUser._id, redeemedAt: now } },
      },
      { new: true }
    );

    if (!updatedCoupon) throw new Error('Atomic coupon update failed');

    await User.findByIdAndUpdate(testUser._id, {
      hasFullAccess: true,
      couponRedeemed: coupon.code,
      fullAccessGrantedAt: now,
    });

    const verified = await User.findById(testUser._id);
    if (!verified.hasFullAccess || verified.couponRedeemed !== CODE) {
      throw new Error('User full access not granted correctly');
    }
    console.log('Redeem OK — hasFullAccess:', verified.hasFullAccess);

    await Coupon.deleteOne({ _id: coupon._id });
    console.log('Cleaned up test coupon');
  }

  const userCount = await User.countDocuments();
  console.log('Platform user count:', userCount);
  console.log('E2E smoke test passed.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('E2E test failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
