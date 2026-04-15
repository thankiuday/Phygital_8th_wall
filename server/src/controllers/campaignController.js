'use strict';

const Campaign = require('../models/Campaign');
const { AppError } = require('../middleware/errorHandler');
const { success, created } = require('../utils/apiResponse');
const { generateUploadSignature, deleteCloudinaryAsset } = require('../services/cloudinaryService');
const { generateQRCode } = require('../services/qrService');

/* ─────────────────────────────────────────
   GET /api/campaigns/upload-signature
   Returns a Cloudinary signed-upload payload.
   Called by the client before each direct upload.
   ───────────────────────────────────────── */
const getUploadSignature = (req, res) => {
  const { resourceType = 'image' } = req.query;

  if (!['image', 'video'].includes(resourceType)) {
    throw new AppError('resourceType must be "image" or "video"', 400);
  }

  const folder = `phygital8thwall/${req.user._id}/${resourceType}s`;
  const payload = generateUploadSignature({ resourceType, folder });

  return success(res, payload, 'Upload signature generated');
};

/* ─────────────────────────────────────────
   POST /api/campaigns
   Creates a new campaign record in MongoDB after
   the client has uploaded the files to Cloudinary.
   ───────────────────────────────────────── */
const createCampaign = async (req, res) => {
  const {
    campaignName,
    targetImageUrl,
    targetImagePublicId,
    videoUrl,
    videoPublicId,
    thumbnailUrl,
  } = req.body;

  if (!campaignName || !targetImageUrl || !videoUrl) {
    throw new AppError('campaignName, targetImageUrl, and videoUrl are required', 400);
  }

  const campaign = await Campaign.create({
    userId: req.user._id,
    campaignName: campaignName.trim(),
    targetImageUrl,
    targetImagePublicId,
    videoUrl,
    videoPublicId,
    thumbnailUrl: thumbnailUrl || null,
    status: 'active',
  });

  // Generate QR code asynchronously — update campaign once done
  // We return the campaign immediately so the client isn't blocked waiting for Cloudinary
  generateQRCode(campaign._id.toString(), req.user._id.toString())
    .then(({ qrCodeUrl, qrPublicId }) => {
      campaign.qrCodeUrl = qrCodeUrl;
      campaign.qrPublicId = qrPublicId;
      return campaign.save({ validateModifiedOnly: true });
    })
    .catch((err) => {
      console.error(`QR generation failed for campaign ${campaign._id}:`, err.message);
    });

  return created(res, { campaign }, 'Campaign created successfully');
};

/* ─────────────────────────────────────────
   GET /api/campaigns
   Returns all campaigns for the authenticated user.
   ───────────────────────────────────────── */
const getCampaigns = async (req, res) => {
  const { status, page = 1, limit = 12 } = req.query;

  const filter = { userId: req.user._id };
  if (status && ['draft', 'active', 'paused'].includes(status)) {
    filter.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [campaigns, total] = await Promise.all([
    Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Campaign.countDocuments(filter),
  ]);

  return success(res, {
    campaigns,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)),
    },
  });
};

/* ─────────────────────────────────────────
   GET /api/campaigns/:id
   Returns a single campaign (owner only).
   ───────────────────────────────────────── */
const getCampaign = async (req, res) => {
  const campaign = await Campaign.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();

  if (!campaign) throw new AppError('Campaign not found', 404);

  return success(res, { campaign });
};

/* ─────────────────────────────────────────
   PATCH /api/campaigns/:id
   Update campaign name or status.
   ───────────────────────────────────────── */
const updateCampaign = async (req, res) => {
  const allowed = ['campaignName', 'status'];
  const updates = {};
  allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid fields to update', 400);
  }

  const campaign = await Campaign.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  );

  if (!campaign) throw new AppError('Campaign not found', 404);

  return success(res, { campaign }, 'Campaign updated');
};

/* ─────────────────────────────────────────
   DELETE /api/campaigns/:id
   Deletes campaign + Cloudinary assets.
   ───────────────────────────────────────── */
const deleteCampaign = async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, userId: req.user._id });
  if (!campaign) throw new AppError('Campaign not found', 404);

  // Remove Cloudinary assets (non-blocking — don't fail delete if CDN call fails)
  await Promise.allSettled([
    deleteCloudinaryAsset(campaign.targetImagePublicId, 'image'),
    deleteCloudinaryAsset(campaign.videoPublicId, 'video'),
  ]);

  await campaign.deleteOne();

  return success(res, {}, 'Campaign deleted');
};

/* ─────────────────────────────────────────
   POST /api/campaigns/:id/duplicate
   Clones a campaign (same assets, new name, new QR code).
   ───────────────────────────────────────── */
const duplicateCampaign = async (req, res) => {
  const original = await Campaign.findOne({
    _id: req.params.id,
    userId: req.user._id,
  }).lean();

  if (!original) throw new AppError('Campaign not found', 404);

  const copy = await Campaign.create({
    userId: original.userId,
    campaignName: `Copy of ${original.campaignName}`,
    targetImageUrl:       original.targetImageUrl,
    targetImagePublicId:  original.targetImagePublicId,
    videoUrl:             original.videoUrl,
    videoPublicId:        original.videoPublicId,
    thumbnailUrl:         original.thumbnailUrl,
    // Match createCampaign — go live immediately; user can Pause from the dashboard.
    status: 'active',
  });

  // Generate a new QR code for the duplicate asynchronously
  generateQRCode(copy._id.toString(), req.user._id.toString())
    .then(({ qrCodeUrl, qrPublicId }) => {
      copy.qrCodeUrl  = qrCodeUrl;
      copy.qrPublicId = qrPublicId;
      return copy.save({ validateModifiedOnly: true });
    })
    .catch((err) => {
      console.error(`QR generation failed for duplicate ${copy._id}:`, err.message);
    });

  return created(res, { campaign: copy }, 'Campaign duplicated successfully');
};

/* ─────────────────────────────────────────
   GET /api/campaigns/:id/qr
   Returns the QR code URL for a campaign.
   Polls until the async QR generation completes.
   ───────────────────────────────────────── */
const getCampaignQR = async (req, res) => {
  const campaign = await Campaign.findOne(
    { _id: req.params.id, userId: req.user._id },
    'qrCodeUrl qrPublicId campaignName'
  ).lean();

  if (!campaign) throw new AppError('Campaign not found', 404);

  return success(res, {
    qrCodeUrl: campaign.qrCodeUrl,
    qrPublicId: campaign.qrPublicId,
    ready: !!campaign.qrCodeUrl,
  });
};

module.exports = {
  getUploadSignature,
  createCampaign,
  getCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  getCampaignQR,
};
