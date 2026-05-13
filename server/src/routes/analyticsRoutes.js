'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOverview,
  getCampaignAnalytics,
  getTrends,
} = require('../controllers/analyticsController');

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Math.max(10, Number(process.env.ANALYTICS_RATE_LIMIT_MAX) || 90),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many analytics requests. Please try again later.' },
  keyGenerator: (req) => (req.user && req.user._id ? String(req.user._id) : req.ip),
});

// All analytics routes require authentication
router.use(protect);
router.use(analyticsLimiter);

// GET /api/analytics/overview?period=7d|30d|90d
router.get('/overview', getOverview);

// GET /api/analytics/trends?period=7d|30d|90d
router.get('/trends', getTrends);

// GET /api/analytics/campaigns/:id?period=7d|30d|90d
router.get('/campaigns/:id', getCampaignAnalytics);

module.exports = router;
