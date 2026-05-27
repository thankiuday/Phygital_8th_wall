'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { redeemCouponSchema } = require('../validators/adminValidators');
const { redeemCoupon } = require('../controllers/couponRedemptionController');

const redeemLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many redemption attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/redeem', protect, redeemLimiter, validate(redeemCouponSchema), redeemCoupon);

module.exports = router;
