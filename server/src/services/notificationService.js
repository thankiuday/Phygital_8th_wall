'use strict';

const Notification = require('../models/Notification');
const User = require('../models/User');
const { getArMediaLabel } = require('../constants/arMediaTypes');

const notifyAdminsOfArRequest = async ({ request, submittingUser }) => {
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
  if (!admins.length) return;

  const submitterLabel =
    submittingUser?.name?.trim()
    || submittingUser?.email
    || 'A user';

  const kind = request.requestKind || 'ar-card';
  const label = getArMediaLabel(kind);
  const assetWord = kind === 'ar-poster' ? 'poster' : 'card';

  await Notification.insertMany(
    admins.map((admin) => ({
      recipientId: admin._id,
      type: 'ar_request_submitted',
      title: `New ${label} request`,
      body: `${submitterLabel} submitted an AR ${assetWord} for fulfillment.`,
      linkPath: '/admin/ar-requests',
      meta: { requestId: String(request._id), requestKind: kind },
    }))
  );
};

const notifyUserArRequestFulfilled = async ({ request, campaign }) => {
  const kind = request.requestKind || campaign.campaignType || 'ar-card';
  const label = getArMediaLabel(kind);
  const assetWord = kind === 'ar-poster' ? 'poster' : 'card';

  await Notification.create({
    recipientId: request.userId,
    type: 'ar_request_fulfilled',
    title: `Your ${label} is ready`,
    body: `Your ${label.toLowerCase()} "${campaign.campaignName}" is live. Open your campaign to download the print-ready ${assetWord} with QR.`,
    linkPath: `/dashboard/campaigns/${campaign._id}`,
    meta: {
      requestId: String(request._id),
      campaignId: String(campaign._id),
      requestKind: kind,
    },
  });
};

module.exports = {
  notifyAdminsOfArRequest,
  notifyUserArRequestFulfilled,
};
