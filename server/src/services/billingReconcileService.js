'use strict';

const User = require('../models/User');
const {
  findActiveSubscriptionForCustomer,
  retrieveSubscriptionForSync,
} = require('../utils/stripeSubscription');
const { syncUserFromSubscription } = require('./billingWebhookService');
const logger = require('../config/logger');

const isMissingStripeResource = (err) =>
  err?.code === 'resource_missing' ||
  /no such customer|no such subscription|similar object exists in live mode|similar object exists in test mode/i.test(
    String(err?.message || '')
  );

const findCustomerIdByEmail = async (stripe, email) => {
  if (!stripe || !email) return null;
  const { data } = await stripe.customers.list({
    email: String(email).trim().toLowerCase(),
    limit: 5,
  });
  return data.find((c) => !c.deleted)?.id || data[0]?.id || null;
};

const findSubscriptionByUserMetadata = async (stripe, userId) => {
  if (!stripe || !userId) return null;
  try {
    const result = await stripe.subscriptions.search({
      query: `metadata['userId']:'${userId}'`,
      limit: 1,
      expand: ['data.items.data.price'],
    });
    const sub = result.data?.[0] || null;
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) return sub;
    return null;
  } catch (err) {
    logger.warn('billing reconcile: subscription search skipped: %s', err.message);
    return null;
  }
};

/**
 * Align MongoDB user billing fields with the Stripe account/mode configured on this server.
 * Heals test/live ID mismatches and missed webhooks.
 */
const reconcileUserBillingFromStripe = async (stripe, user) => {
  if (!stripe || !user) return user;

  let subscription = null;
  let customerId = user.stripeCustomerId || null;

  if (user.subscriptionId) {
    try {
      subscription = await retrieveSubscriptionForSync(stripe, user.subscriptionId);
    } catch (err) {
      if (isMissingStripeResource(err)) {
        logger.warn(
          'billing reconcile: clearing stale subscription %s for user %s',
          user.subscriptionId,
          user._id
        );
        await User.findByIdAndUpdate(user._id, {
          $unset: {
            subscriptionId: 1,
            subscriptionStatus: 1,
            subscriptionPriceId: 1,
            currentPeriodStart: 1,
            currentPeriodEnd: 1,
          },
          subscriptionCancelAtPeriodEnd: false,
          plan: user.hasFullAccess ? user.plan : 'free',
        });
        user.subscriptionId = null;
        user.subscriptionStatus = null;
      } else {
        throw err;
      }
    }
  }

  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
    } catch (err) {
      if (isMissingStripeResource(err)) {
        logger.warn(
          'billing reconcile: clearing stale customer %s for user %s',
          customerId,
          user._id
        );
        await User.findByIdAndUpdate(user._id, { $unset: { stripeCustomerId: 1 } });
        customerId = null;
        user.stripeCustomerId = null;
      } else {
        throw err;
      }
    }
  }

  if (!customerId) {
    customerId = await findCustomerIdByEmail(stripe, user.email);
    if (customerId) {
      user = await User.findByIdAndUpdate(
        user._id,
        { stripeCustomerId: customerId },
        { new: true }
      );
    }
  }

  if (!subscription && customerId) {
    subscription = await findActiveSubscriptionForCustomer(stripe, customerId);
  }

  if (!subscription) {
    subscription = await findSubscriptionByUserMetadata(stripe, user._id.toString());
  }

  if (subscription) {
    const synced = await syncUserFromSubscription(subscription, {
      userId: user._id.toString(),
    });
    if (synced) return synced;
  }

  return user;
};

module.exports = {
  reconcileUserBillingFromStripe,
  findCustomerIdByEmail,
};
