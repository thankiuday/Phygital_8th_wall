'use strict';

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
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
  checkCardSlugAvailability,
  renderCampaignCardImage,
} = require('../controllers/campaignController');

router.use(protect);

router.get('/upload-signature', getUploadSignature);

/**
 * Check whether a `cardSlug` is available before the wizard saves it. Cheap
 * lookup with a sane per-user limit (used inline as the user types).
 */
const slugCheckLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?._id || 'anon'}:slug`,
});
router.get('/check-card-slug', slugCheckLimiter, checkCardSlugAvailability);

/**
 * Strict per-user limit on print rendering — Puppeteer is the most expensive
 * thing this server can do, so we cap individual users at a low ceiling and
 * rely on the Cloudinary cache (controlled by the deterministic `renderHash`)
 * to make repeat downloads free.
 */
const cardImageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?._id || 'anon'}:card-image`,
  message: 'Too many card downloads — please wait a minute and try again.',
});
const cardImageDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?._id || 'anon'}:card-image-daily`,
  message: 'Daily card download limit reached. Try again tomorrow.',
});
router.post(
  '/:id/card-image',
  cardImageLimiter,
  cardImageDailyLimiter,
  renderCampaignCardImage
);

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
