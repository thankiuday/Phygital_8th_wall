'use strict';

const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  getOverview,
  getCampaignAnalytics,
  getTrends,
} = require('../controllers/analyticsController');

// All analytics routes require authentication
router.use(protect);

// GET /api/analytics/overview?period=7d|30d|90d
router.get('/overview', getOverview);

// GET /api/analytics/trends?period=7d|30d|90d
router.get('/trends', getTrends);

// GET /api/analytics/campaigns/:id?period=7d|30d|90d
router.get('/campaigns/:id', getCampaignAnalytics);

module.exports = router;
