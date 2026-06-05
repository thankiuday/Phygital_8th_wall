'use strict';

const { AppError } = require('./errorHandler');
const { hasPhygitalQrAccess } = require('../utils/subscriptionAccess');

/**
 * Blocks Phygital QR campaign creation unless the user has an active
 * Phygital QR subscription (or partner / admin full access).
 */
const requirePhygitalQrAccess = (req, _res, next) => {
  if (hasPhygitalQrAccess(req.user)) {
    return next();
  }
  return next(
    new AppError(
      'Subscribe to Phygital QR before creating this campaign. Open Settings → Subscription or visit Pricing to subscribe.',
      403
    )
  );
};

module.exports = requirePhygitalQrAccess;
