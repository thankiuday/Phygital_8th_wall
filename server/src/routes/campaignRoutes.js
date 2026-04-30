'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createCampaignSchema,
  updateCampaignSchema,
} = require('../validators/campaignValidators');
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

router.use(protect);

router.get('/upload-signature', getUploadSignature);

router.route('/')
  .get(getCampaigns)
  .post(validate(createCampaignSchema), createCampaign);

router.get('/:id/qr', getCampaignQR);
router.post('/:id/duplicate', duplicateCampaign);

router.route('/:id')
  .get(getCampaign)
  .patch(validate(updateCampaignSchema), updateCampaign)
  .delete(deleteCampaign);

module.exports = router;
