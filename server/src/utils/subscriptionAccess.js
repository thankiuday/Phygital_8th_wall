'use strict';

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing']);

/**
 * Effective paid tier: admin full access OR active Phygital QR subscription.
 */
const hasPhygitalQrAccess = (user) => {
  if (!user) return false;
  if (user.hasFullAccess) return true;
  return (
    user.plan === 'phygital_qr' &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus)
  );
};

/**
 * Display / API plan slug (enterprise-equivalent when admin coupon applied).
 */
const getEffectivePlan = (user) => {
  if (!user) return 'free';
  if (user.hasFullAccess) return 'enterprise';
  if (
    user.plan === 'phygital_qr' &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus)
  ) {
    return 'phygital_qr';
  }
  return user.plan || 'free';
};

const subscriptionFieldsForClient = (user) => ({
  plan: user.plan || 'free',
  effectivePlan: getEffectivePlan(user),
  hasPhygitalQrAccess: hasPhygitalQrAccess(user),
  subscriptionStatus: user.subscriptionStatus || null,
  subscriptionPriceId: user.subscriptionPriceId || null,
  promotionCodeUsed: user.promotionCodeUsed || null,
  currentPeriodEnd: user.currentPeriodEnd || null,
  stripeCustomerId: user.stripeCustomerId ? true : false,
});

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  hasPhygitalQrAccess,
  getEffectivePlan,
  subscriptionFieldsForClient,
};
