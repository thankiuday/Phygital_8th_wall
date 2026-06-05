'use strict';

const User = require('../models/User');
const { getStripe } = require('../config/stripe');
const logger = require('../config/logger');
const {
  periodDatesFromSubscription,
  priceIdFromSubscription,
  retrieveSubscriptionForSync,
} = require('../utils/stripeSubscription');

const PHYGITALIZE_CODE_PREFIX = /^PHYGITALIZE\d{2,3}$/i;

const syncUserFromSubscription = async (subscription, extra = {}) => {
  const stripe = getStripe();
  if (!stripe || !subscription) return null;

  const userId =
    subscription.metadata?.userId ||
    extra.userId ||
    null;

  let user = null;
  if (userId) {
    user = await User.findById(userId);
  }
  if (!user && subscription.customer) {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;
    user = await User.findOne({ stripeCustomerId: customerId });
  }
  if (!user) {
    logger.warn('billing webhook: no user for subscription %s', subscription.id);
    return null;
  }

  const status = subscription.status;
  const priceId = priceIdFromSubscription(subscription);
  const { currentPeriodStart, currentPeriodEnd } = periodDatesFromSubscription(subscription);
  const isPaidActive = status === 'active' || status === 'trialing';

  const update = {
    stripeCustomerId:
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id || user.stripeCustomerId,
    subscriptionId: subscription.id,
    subscriptionStatus: status,
    subscriptionPriceId: priceId,
    currentPeriodStart,
    currentPeriodEnd,
  };

  if (extra.promotionCodeUsed) {
    update.promotionCodeUsed = extra.promotionCodeUsed;
  }

  if (isPaidActive) {
    update.plan = 'phygital_qr';
  } else if (!user.hasFullAccess) {
    update.plan = 'free';
  }

  return User.findByIdAndUpdate(user._id, update, { new: true });
};

const promotionCodeFromSubscription = async (subscriptionId) => {
  const stripe = getStripe();
  if (!stripe || !subscriptionId) return null;

  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['discounts', 'discounts.promotion_code'],
    });
    const discount = sub.discounts?.[0] || sub.discount;
    const promo = discount?.promotion_code;
    if (typeof promo === 'object' && promo?.code) {
      return String(promo.code).toUpperCase();
    }
    if (typeof promo === 'string') {
      const row = await stripe.promotionCodes.retrieve(promo);
      if (row?.code) return String(row.code).toUpperCase();
    }
  } catch (err) {
    logger.warn('billing: promotion code from subscription: %s', err.message);
  }
  return null;
};

const handleCheckoutSessionCompleted = async (session) => {
  const stripe = getStripe();
  if (!stripe) return;

  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) {
    logger.warn('checkout.session.completed without user id');
    return;
  }

  const user = await User.findById(userId);
  if (!user) return;

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;

  if (customerId && !user.stripeCustomerId) {
    await User.findByIdAndUpdate(user._id, { stripeCustomerId: customerId });
  }

  if (session.subscription) {
    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
    const promotionCodeUsed = await promotionCodeFromSubscription(subId);
    const subscription = await retrieveSubscriptionForSync(stripe, subId);
    if (!subscription.metadata?.userId) {
      await stripe.subscriptions.update(subId, {
        metadata: { userId: user._id.toString() },
      });
      subscription.metadata = { ...subscription.metadata, userId: user._id.toString() };
    }
    await syncUserFromSubscription(subscription, {
      userId: user._id.toString(),
      promotionCodeUsed: promotionCodeUsed || undefined,
    });
  }
};

const handleSubscriptionEvent = async (subscription) => {
  const stripe = getStripe();
  if (!stripe) return;
  const full = await retrieveSubscriptionForSync(stripe, subscription);
  if (!full) return;
  await syncUserFromSubscription(full);
};

const handleInvoicePaymentFailed = async (invoice) => {
  const subId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id;
  if (!subId) return;

  const stripe = getStripe();
  if (!stripe) return;

  const subscription = await retrieveSubscriptionForSync(stripe, subId);
  if (!subscription) return;
  await syncUserFromSubscription(subscription);
};

const processStripeWebhookEvent = async (event) => {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(event.data.object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionEvent(event.data.object);
      break;
    case 'invoice.paid':
      if (event.data.object?.subscription) {
        const stripe = getStripe();
        const sub = await retrieveSubscriptionForSync(stripe, event.data.object.subscription);
        if (sub) await syncUserFromSubscription(sub);
      }
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;
    default:
      break;
  }
};

module.exports = {
  PHYGITALIZE_CODE_PREFIX,
  syncUserFromSubscription,
  processStripeWebhookEvent,
  promotionCodeFromSubscription,
};
