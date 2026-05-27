'use strict';

const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const { generateQRCode } = require('./qrService');
const { allocateUniqueHubSlugForUser } = require('../utils/campaignHubSlug');
const { allocateUniqueHandleFromEmail } = require('../utils/userHandle');
const { generateUniqueRedirectSlug } = require('../utils/redirectSlugAllocator');

/**
 * arCardCampaignService — AR business card create + hub field allocation.
 * Keeps campaignController thin; reuses the same patterns as hub QR campaigns.
 */

const ensureOwnerHubFields = async (userId, campaignNameTrimmed) => {
  const userDoc = await User.findById(userId).select('handle email').lean();
  if (!userDoc) throw new AppError('User not found', 401);
  let ownerHandle = userDoc.handle;
  if (!ownerHandle) {
    const u = await User.findById(userId).select('email');
    if (!u) throw new AppError('User not found', 401);
    ownerHandle = await allocateUniqueHandleFromEmail(User, u.email);
    await User.updateOne({ _id: userId }, { $set: { handle: ownerHandle } });
  }
  const hubSlug = await allocateUniqueHubSlugForUser(Campaign, userId, campaignNameTrimmed);
  return { ownerHandle, hubSlug };
};

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId} params.userId
 * @param {object} params.body — validated ar-card create payload
 * @param {Function} params.persistLinkItems — async (linkItems) => persisted rows
 */
const createArCardCampaignRecord = async ({ userId, body, persistLinkItems }) => {
  const campaignType = body.campaignType || 'ar-card';

  const {
    campaignName,
    targetImageUrl,
    targetImagePublicId,
    targetImageOriginalUrl,
    targetImageOriginalPublicId,
    videoUrl,
    videoPublicId,
    videoUrlIos,
    videoIosPublicId,
    thumbnailUrl,
    linkItems,
    qrDesign,
    qrPlacement,
  } = body;

  const redirectSlug = await generateUniqueRedirectSlug();
  const { ownerHandle, hubSlug } = await ensureOwnerHubFields(userId, campaignName.trim());

  const persistedItems = linkItems?.length
    ? await persistLinkItems(linkItems)
    : [];

  const campaign = await Campaign.create({
    userId,
    campaignType,
    campaignName: campaignName.trim(),
    targetImageUrl,
    targetImagePublicId: targetImagePublicId || null,
    targetImageOriginalUrl: targetImageOriginalUrl || targetImageUrl,
    targetImageOriginalPublicId: targetImageOriginalPublicId || targetImagePublicId || null,
    videoUrl,
    videoPublicId: videoPublicId || null,
    videoUrlIos: videoUrlIos || null,
    videoIosPublicId: videoIosPublicId || null,
    thumbnailUrl: thumbnailUrl ?? null,
    videoSource: 'upload',
    linkItems: persistedItems.length ? persistedItems : undefined,
    qrDesign: qrDesign || null,
    qrPlacement: qrPlacement || null,
    redirectSlug,
    ownerHandle,
    hubSlug,
    preciseGeoAnalytics: true,
    status: 'active',
  });

  generateQRCode(campaign._id.toString(), userId.toString())
    .then(({ qrCodeUrl, qrPublicId }) => {
      campaign.qrCodeUrl = qrCodeUrl;
      campaign.qrPublicId = qrPublicId;
      return campaign.save({ validateModifiedOnly: true });
    })
    .catch((err) => {
      logger.warn('AR QR generation failed', {
        campaignId: String(campaign._id),
        error: err.message,
      });
    });

  return campaign;
};

module.exports = {
  createArCardCampaignRecord,
  ensureOwnerHubFields,
};
