'use strict';

const express = require('express');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { z } = require('zod');
const {
  createCheckoutSession,
  createPortalSession,
  getBillingStatus,
} = require('../controllers/billingController');

const router = express.Router();

const checkoutSessionSchema = z.object({
  billingCycle: z.enum(['monthly', 'yearly']).default('monthly'),
});

router.get('/status', protect, getBillingStatus);
router.post(
  '/checkout-session',
  protect,
  validate(checkoutSessionSchema),
  createCheckoutSession
);
router.post('/portal', protect, createPortalSession);

module.exports = router;
