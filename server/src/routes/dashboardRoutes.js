'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/dashboardController');

// All dashboard routes require a valid access token
router.use(protect);

router.get('/stats', getDashboardStats);

module.exports = router;
