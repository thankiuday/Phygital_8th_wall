'use strict';

const Stripe = require('stripe');

let stripeClient = null;

/**
 * Lazy Stripe client — billing routes stay optional until STRIPE_SECRET_KEY is set.
 */
const getStripe = () => {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key);
  }
  return stripeClient;
};

const isStripeConfigured = () => !!(process.env.STRIPE_SECRET_KEY || '').trim();

const getPhygitalQrPriceId = (billingCycle) => {
  const cycle = String(billingCycle || 'monthly').toLowerCase();
  if (cycle === 'yearly' || cycle === 'annual' || cycle === 'year') {
    return (process.env.STRIPE_PRICE_PHYGITAL_QR_YEARLY || '').trim();
  }
  return (process.env.STRIPE_PRICE_PHYGITAL_QR_MONTHLY || '').trim();
};

module.exports = {
  getStripe,
  isStripeConfigured,
  getPhygitalQrPriceId,
};
