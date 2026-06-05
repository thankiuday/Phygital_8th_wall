'use strict';

const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { success, created } = require('../utils/apiResponse');
const { getStripe, isStripeConfigured, getPhygitalQrPriceId } = require('../config/stripe');
const { subscriptionFieldsForClient, hasPhygitalQrAccess } = require('../utils/subscriptionAccess');
const {
  processStripeWebhookEvent,
  syncUserFromSubscription,
} = require('../services/billingWebhookService');
const {
  findActiveSubscriptionForCustomer,
  retrieveSubscriptionForSync,
} = require('../utils/stripeSubscription');
const logger = require('../config/logger');

const clientBaseUrl = () => {
  const url = (process.env.CLIENT_URL || 'http://localhost:5173').trim();
  return url.replace(/\/$/, '');
};

const requireStripe = () => {
  const stripe = getStripe();
  if (!stripe) {
    throw new AppError('Billing is not configured. Contact support.', 503);
  }
  return stripe;
};

/**
 * POST /api/billing/checkout-session
 * Body: { billingCycle: 'monthly' | 'yearly' }
 */
exports.createCheckoutSession = async (req, res) => {
  if (!isStripeConfigured()) {
    throw new AppError('Billing is not configured', 503);
  }

  const stripe = requireStripe();
  const billingCycle = req.body?.billingCycle || 'monthly';
  const priceId = getPhygitalQrPriceId(billingCycle);

  if (!priceId) {
    throw new AppError(
      'Subscription price is not configured. Set STRIPE_PRICE_PHYGITAL_QR_MONTHLY and STRIPE_PRICE_PHYGITAL_QR_YEARLY.',
      503
    );
  }

  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  if (user.hasFullAccess) {
    throw new AppError(
      'Your account already has full access via a partner code. No subscription is required.',
      400
    );
  }

  if (
    user.plan === 'phygital_qr' &&
    (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing')
  ) {
    throw new AppError(
      'You already have an active Phygital QR subscription. Use Manage billing to change or cancel.',
      400
    );
  }

  const base = clientBaseUrl();
  const sessionParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    client_reference_id: user._id.toString(),
    metadata: {
      userId: user._id.toString(),
      billingCycle: String(billingCycle),
    },
    subscription_data: {
      metadata: { userId: user._id.toString() },
    },
    success_url: `${base}/dashboard/settings?billing=success`,
    cancel_url: `${base}/pricing?billing=canceled`,
  };

  if (user.stripeCustomerId) {
    sessionParams.customer = user.stripeCustomerId;
  } else {
    sessionParams.customer_email = user.email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  return created(res, { url: session.url, sessionId: session.id }, 'Checkout session created');
};

/**
 * POST /api/billing/portal
 */
exports.createPortalSession = async (req, res) => {
  const stripe = requireStripe();
  const user = await User.findById(req.user._id);
  if (!user?.stripeCustomerId) {
    throw new AppError('No billing account found. Subscribe to Phygital QR first.', 400);
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${clientBaseUrl()}/dashboard/settings`,
  });

  return success(res, { url: portal.url }, 'Portal session created');
};

/**
 * GET /api/billing/status
 */
exports.getBillingStatus = async (req, res) => {
  let user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  const stripe = getStripe();
  if (stripe) {
    try {
      let subscription = null;
      if (user.subscriptionId) {
        subscription = await retrieveSubscriptionForSync(stripe, user.subscriptionId);
      } else if (user.stripeCustomerId) {
        subscription = await findActiveSubscriptionForCustomer(stripe, user.stripeCustomerId);
      }
      if (subscription) {
        const synced = await syncUserFromSubscription(subscription, {
          userId: user._id.toString(),
        });
        if (synced) user = synced;
      }
    } catch (err) {
      logger.warn('billing status sync failed for user %s: %s', user._id, err.message);
    }
  }

  return success(res, {
    billingConfigured: isStripeConfigured(),
    ...subscriptionFieldsForClient(user),
  });
};

/**
 * POST /api/billing/webhook — raw body, mounted separately in index.js
 */
exports.handleWebhook = async (req, res) => {
  const stripe = getStripe();
  const webhookSecret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();

  if (!stripe || !webhookSecret) {
    logger.error('Stripe webhook called but STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing');
    return res.status(503).send('Billing not configured');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing stripe-signature');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    logger.warn('Stripe webhook signature failed: %s', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    await processStripeWebhookEvent(event);
  } catch (err) {
    logger.error('Stripe webhook handler error: %s', err.message);
    return res.status(500).send('Webhook handler failed');
  }

  return res.json({ received: true });
};
