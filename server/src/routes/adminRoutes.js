'use strict';

const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getStats,
  getUsers,
  updateUser,
  getCampaigns,
  updateCampaign,
} = require('../controllers/adminController');

// Every admin route requires: valid JWT + role === 'admin'
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);

router.route('/users')
  .get(getUsers);

router.route('/users/:id')
  .patch(updateUser);

router.route('/campaigns')
  .get(getCampaigns);

router.route('/campaigns/:id')
  .patch(updateCampaign);

module.exports = router;
