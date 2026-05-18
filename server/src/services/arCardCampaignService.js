'use strict';

const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');
const { generateQRCode } = require('./qrService');
const { allocateUniqueHubSlugForUser } = require('../utils/campaignHubSlug');
const { allocateUniqueHandleFromEmail } = require('../utils/userHandle');

/**
 * arCardCampaignService — AR business card create + hub field allocation.
 * Keeps campaignController thin; reuses the same patterns as hub QR campaigns.
 */

let nanoidPromise = null;
const getNanoid = async () => {
  if (!nanoidPromise) {
    nanoidPromise = import('nanoid').then((m) => m.nanoid);
  }
  return nanoidPromise;
};

const generateUniqueRedirectSlug = async () => {
  const nanoid = await getNanoid();
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = nanoid();
    const exists = await Campaign.exists({ redirectSlug: slug });
    if (!exists) return slug;
    logger.warn('redirectSlug collision — retrying', { slug, attempt });
  }
  throw new AppError('Could not allocate a unique short URL — please retry', 500);
};

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
  const {
    campaignName,
    targetImageUrl,
    targetImagePublicId,
    targetImageOriginalUrl,
    targetImageOriginalPublicId,
    videoUrl,
    videoPublicId,
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
    campaignType: 'ar-card',
    campaignName: campaignName.trim(),
    targetImageUrl,
    targetImagePublicId: targetImagePublicId || null,
    targetImageOriginalUrl: targetImageOriginalUrl || targetImageUrl,
    targetImageOriginalPublicId: targetImageOriginalPublicId || targetImagePublicId || null,
    videoUrl,
    videoPublicId: videoPublicId || null,
    thumbnailUrl: thumbnailUrl ?? null,
    videoSource: 'upload',
    linkItems: persistedItems.length ? persistedItems : undefined,
    qrDesign: qrDesign || null,
    qrPlacement: qrPlacement || null,
    redirectSlug,
    ownerHandle,
    hubSlug,
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
