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

const PHYGITAL_QR_PRICING = {
  monthly: { cents: 1499, currency: 'usd', label: '$14.99/mo' },
  yearly: { cents: 14900, currency: 'usd', label: '$149/yr' },
};

const getBillingCycleFromPriceId = (priceId) => {
  const id = (priceId || '').trim();
  if (!id) return null;
  const yearly = (process.env.STRIPE_PRICE_PHYGITAL_QR_YEARLY || '').trim();
  const monthly = (process.env.STRIPE_PRICE_PHYGITAL_QR_MONTHLY || '').trim();
  if (yearly && id === yearly) return 'yearly';
  if (monthly && id === monthly) return 'monthly';
  return null;
};

module.exports = {
  getStripe,
  isStripeConfigured,
  getPhygitalQrPriceId,
  PHYGITAL_QR_PRICING,
  getBillingCycleFromPriceId,
};
