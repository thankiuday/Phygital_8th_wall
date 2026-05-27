'use strict';

const ArCardServiceRequest = require('../models/ArCardServiceRequest');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { success, created } = require('../utils/apiResponse');
const { persistLinkItemsFromBody } = require('../utils/persistLinkItems');
const { createArCardCampaignRecord } = require('../services/arCardCampaignService');
const { isArMediaType } = require('../constants/arMediaTypes');
const {
  notifyAdminsOfArRequest,
  notifyUserArRequestFulfilled,
} = require('../services/notificationService');

const OPEN_STATUSES = ['submitted', 'in_progress'];

const slaMessageForKind = (requestKind) => {
  if (requestKind === 'ar-poster') {
    return 'Your AR poster request was received. Our team will configure it within 24 hours.';
  }
  return 'Your AR card request was received. Our team will configure it within 24 hours.';
};

const openRequestMessageForKind = (requestKind) => {
  if (requestKind === 'ar-poster') {
    return 'You already have an AR poster request in progress. We will notify you when it is ready.';
  }
  return 'You already have an AR card request in progress. We will notify you when it is ready.';
};

const persistRequestLinkItems = async (linkItems) => {
  if (!linkItems?.length) return [];
  return persistLinkItemsFromBody(linkItems);
};

exports.createRequest = async (req, res) => {
  const requestKind = req.body.requestKind || 'ar-card';

  const open = await ArCardServiceRequest.findOne({
    userId: req.user._id,
    requestKind,
    status: { $in: OPEN_STATUSES },
  });
  if (open) {
    throw new AppError(openRequestMessageForKind(requestKind), 409);
  }

  const {
    targetImageUrl,
    targetImagePublicId,
    qrPlacement,
    greenscreenVideoUrl,
    greenscreenVideoPublicId,
    linkItems,
    userNotes,
  } = req.body;

  const persistedLinks = await persistRequestLinkItems(linkItems);

  const request = await ArCardServiceRequest.create({
    userId: req.user._id,
    requestKind,
    status: 'submitted',
    targetImageUrl,
    targetImagePublicId: targetImagePublicId || null,
    qrPlacement,
    greenscreenVideoUrl,
    greenscreenVideoPublicId: greenscreenVideoPublicId || null,
    linkItems: persistedLinks.length ? persistedLinks : undefined,
    userNotes: userNotes || null,
    submittedAt: new Date(),
  });

  notifyAdminsOfArRequest({ request, submittingUser: req.user }).catch(() => {});

  const slaMessage = slaMessageForKind(requestKind);

  return created(
    res,
    { request, slaMessage },
    slaMessage
  );
};

exports.listMyRequests = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = { userId: req.user._id };
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [requests, total] = await Promise.all([
    ArCardServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('campaignId', 'campaignName status _id campaignType')
      .lean(),
    ArCardServiceRequest.countDocuments(filter),
  ]);

  return success(res, {
    requests,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
  });
};

exports.getMyRequest = async (req, res) => {
  const request = await ArCardServiceRequest.findOne({
    _id: req.params.id,
    userId: req.user._id,
  })
    .populate('campaignId', 'campaignName status _id hubSlug ownerHandle campaignType')
    .lean();

  if (!request) throw new AppError('Request not found', 404);

  return success(res, {
    request,
    slaMessage: slaMessageForKind(request.requestKind || 'ar-card'),
  });
};

// ─── Admin ───────────────────────────────────────────────────────────────────

exports.adminListRequests = async (req, res) => {
  const { page = 1, limit = 20, status, search = '', requestKind } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (requestKind) filter.requestKind = requestKind;

  if (search.trim()) {
    const users = await User.find({
      $or: [
        { email: { $regex: search.trim(), $options: 'i' } },
        { name: { $regex: search.trim(), $options: 'i' } },
      ],
    })
      .select('_id')
      .lean();
    const userIds = users.map((u) => u._id);
    filter.userId = { $in: userIds };
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [requests, total] = await Promise.all([
    ArCardServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'name email')
      .populate('campaignId', 'campaignName status _id campaignType')
      .populate('fulfilledBy', 'name email')
      .lean(),
    ArCardServiceRequest.countDocuments(filter),
  ]);

  return success(res, {
    requests,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit)) || 1,
    },
  });
};

exports.adminGetRequest = async (req, res) => {
  const request = await ArCardServiceRequest.findById(req.params.id)
    .populate('userId', 'name email handle')
    .populate('campaignId', 'campaignName status _id hubSlug ownerHandle campaignType')
    .populate('fulfilledBy', 'name email')
    .lean();

  if (!request) throw new AppError('Request not found', 404);

  return success(res, { request });
};

exports.adminUpdateRequest = async (req, res) => {
  const { status, adminNotes } = req.body;
  const request = await ArCardServiceRequest.findById(req.params.id);
  if (!request) throw new AppError('Request not found', 404);

  if (request.status === 'completed') {
    throw new AppError('Cannot update a completed request', 400);
  }

  if (status) request.status = status;
  if (adminNotes !== undefined) request.adminNotes = adminNotes;

  await request.save();

  return success(res, { request }, 'Request updated');
};

exports.adminFulfillRequest = async (req, res) => {
  const request = await ArCardServiceRequest.findById(req.params.id);
  if (!request) throw new AppError('Request not found', 404);

  if (request.status === 'completed') {
    throw new AppError('Request is already fulfilled', 400);
  }
  if (request.status === 'cancelled') {
    throw new AppError('Request was cancelled', 400);
  }

  const campaignType = request.requestKind || 'ar-card';
  const fulfillBody = { ...req.body, campaignType };

  const campaign = await createArCardCampaignRecord({
    userId: request.userId,
    body: fulfillBody,
    persistLinkItems: persistLinkItemsFromBody,
  });

  request.status = 'completed';
  request.campaignId = campaign._id;
  request.fulfilledBy = req.user._id;
  request.completedAt = new Date();
  await request.save();

  notifyUserArRequestFulfilled({ request, campaign }).catch(() => {});

  const populated = await ArCardServiceRequest.findById(request._id)
    .populate('userId', 'name email')
    .populate('campaignId', 'campaignName status _id campaignType')
    .lean();

  return success(
    res,
    { request: populated, campaign },
    'AR media campaign created for user'
  );
};

/** Admin — set composited print image on a fulfilled AR campaign */
exports.adminPatchCampaignAssets = async (req, res) => {
  const { targetImageUrl, targetImagePublicId } = req.body;
  if (!targetImageUrl) throw new AppError('targetImageUrl is required', 400);

  const campaign = await Campaign.findById(req.params.campaignId);
  if (!campaign) throw new AppError('Campaign not found', 404);
  if (!isArMediaType(campaign.campaignType)) {
    throw new AppError('Only AR media campaigns support asset patch', 400);
  }

  campaign.targetImageUrl = targetImageUrl;
  campaign.targetImagePublicId = targetImagePublicId || null;
  await campaign.save({ validateModifiedOnly: true });

  return success(res, { campaign }, 'Campaign assets updated');
};
