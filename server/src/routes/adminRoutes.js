'use strict';

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  getStats,
  getUsers,
  updateUser,
  getCampaigns,
  updateCampaign,
} = require('../controllers/adminController');
const superAdmin = require('../controllers/superAdminController');
const {
  createCouponSchema,
  updateCouponSchema,
  adminResetPasswordSchema,
} = require('../validators/adminValidators');
const { arMediaCreateSchema } = require('../validators/campaignValidators');
const {
  updateArServiceRequestAdminSchema,
  patchArCampaignAssetsSchema,
} = require('../validators/arServiceRequestValidators');
const arServiceRequest = require('../controllers/arServiceRequestController');

router.use(protect);
router.use(authorize('admin'));

// Legacy stats
router.get('/stats', getStats);

// Analytics
router.get('/analytics/platform', superAdmin.getPlatformKPIs);
router.get('/analytics/signups-trend', superAdmin.getSignupsTrend);
router.get('/analytics/scans-trend', superAdmin.getScansTrend);
router.get('/analytics/campaign-types', superAdmin.getCampaignTypeBreakdown);
router.get('/analytics/devices', superAdmin.getDeviceBreakdown);
router.get('/analytics/geo', superAdmin.getGeoBreakdown);
router.get('/analytics/top-campaigns', superAdmin.getTopCampaigns);
router.get('/analytics/engagement', superAdmin.getEngagementStats);
router.get('/analytics/retention', superAdmin.getRetentionBreakdown);
router.get('/analytics/hourly-heatmap', superAdmin.getHourlyHeatmap);

// Users (specific routes before generic :id patch)
router.get('/users', getUsers);
router.get('/users/:id', superAdmin.getUserDetail);
router.delete('/users/:id', superAdmin.deleteUser);
router.patch(
  '/users/:id/reset-password',
  validate(adminResetPasswordSchema),
  superAdmin.adminResetPassword
);
router.patch('/users/:id', updateUser);

// Campaigns
router.get('/campaigns', getCampaigns);
router.get('/campaigns/:id', superAdmin.getCampaignDetail);
router.patch('/campaigns/:id', updateCampaign);

// AR card service requests
router.get('/ar-service-requests', arServiceRequest.adminListRequests);
router.get('/ar-service-requests/:id', arServiceRequest.adminGetRequest);
router.patch(
  '/ar-service-requests/:id',
  validate(updateArServiceRequestAdminSchema),
  arServiceRequest.adminUpdateRequest
);
router.post(
  '/ar-service-requests/:id/fulfill',
  validate(arMediaCreateSchema),
  arServiceRequest.adminFulfillRequest
);
router.patch(
  '/campaigns/:campaignId/ar-assets',
  validate(patchArCampaignAssetsSchema),
  arServiceRequest.adminPatchCampaignAssets
);

// Coupons
router.get('/coupons', superAdmin.listCoupons);
router.post('/coupons', validate(createCouponSchema), superAdmin.createCoupon);
router.patch('/coupons/:id', validate(updateCouponSchema), superAdmin.updateCoupon);
router.delete('/coupons/:id', superAdmin.deleteCoupon);

module.exports = router;
