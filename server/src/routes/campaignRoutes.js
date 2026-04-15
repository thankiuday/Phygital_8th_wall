'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getUploadSignature,
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaignQR,
} = require('../controllers/campaignController');

// All campaign routes are protected
router.use(protect);

router.get('/upload-signature', getUploadSignature);

router.route('/')
  .get(getCampaigns)
  .post(createCampaign);

router.get('/:id/qr', getCampaignQR);
router.post('/:id/duplicate', duplicateCampaign);

router.route('/:id')
  .get(getCampaign)
  .patch(updateCampaign)
  .delete(deleteCampaign);

module.exports = router;
