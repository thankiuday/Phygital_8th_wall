'use strict';

const { getBillingCycleFromPriceId, PHYGITAL_QR_PRICING } = require('../config/stripe');

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

const subscriptionFieldsForClient = (user) => {
  const billingCycle = getBillingCycleFromPriceId(user.subscriptionPriceId);
  const pricing = billingCycle ? PHYGITAL_QR_PRICING[billingCycle] : null;
  const isSubscriptionActive =
    user.plan === 'phygital_qr' &&
    ACTIVE_SUBSCRIPTION_STATUSES.has(user.subscriptionStatus);

  return {
    plan: user.plan || 'free',
    effectivePlan: getEffectivePlan(user),
    hasPhygitalQrAccess: hasPhygitalQrAccess(user),
    subscriptionStatus: user.subscriptionStatus || null,
    subscriptionPriceId: user.subscriptionPriceId || null,
    promotionCodeUsed: user.promotionCodeUsed || null,
    currentPeriodStart: user.currentPeriodStart || null,
    currentPeriodEnd: user.currentPeriodEnd || null,
    billingCycle,
    billingAmountCents: pricing?.cents ?? null,
    billingCurrency: pricing?.currency ?? 'usd',
    billingPriceLabel: pricing?.label ?? null,
    isSubscriptionActive,
    cancelAtPeriodEnd: !!user.subscriptionCancelAtPeriodEnd,
    stripeCustomerId: user.stripeCustomerId ? true : false,
  };
};

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  hasPhygitalQrAccess,
  getEffectivePlan,
  subscriptionFieldsForClient,
};
