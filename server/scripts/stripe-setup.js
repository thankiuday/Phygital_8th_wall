'use strict';

/**
 * Bootstrap Stripe test catalog: Phygital QR product, prices, PHYGITALIZE10–70 coupons.
 *
 * Usage (from server/):
 *   node scripts/stripe-setup.js
 *
 * Requires STRIPE_SECRET_KEY in .env. Prints env vars to add after success.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Stripe = require('stripe');

const PRODUCT_NAME = 'Phygital QR';
const MONTHLY_CENTS = 1499;
const YEARLY_CENTS = 14900;
const DISCOUNT_PERCENTS = [10, 20, 30, 40, 50, 60, 70];

const main = async () => {
  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    console.error('Missing STRIPE_SECRET_KEY in server/.env');
    process.exit(1);
  }

  const stripe = new Stripe(key);
  const existingProducts = await stripe.products.list({ limit: 100, active: true });
  let product = existingProducts.data.find(
    (p) => p.name === PRODUCT_NAME || p.metadata?.phygital_plan === 'phygital_qr'
  );

  if (!product) {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: 'Phygital QR — video/AR hosting and advanced analytics',
      metadata: { phygital_plan: 'phygital_qr' },
    });
    console.log('Created product:', product.id);
  } else {
    console.log('Using existing product:', product.id);
  }

  const prices = await stripe.prices.list({ product: product.id, limit: 20 });
  let monthlyPrice = prices.data.find(
    (p) => p.recurring?.interval === 'month' && p.unit_amount === MONTHLY_CENTS
  );
  let yearlyPrice = prices.data.find(
    (p) => p.recurring?.interval === 'year' && p.unit_amount === YEARLY_CENTS
  );

  if (!monthlyPrice) {
    monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: MONTHLY_CENTS,
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: { billing_cycle: 'monthly' },
    });
    console.log('Created monthly price:', monthlyPrice.id);
  } else {
    console.log('Using monthly price:', monthlyPrice.id);
  }

  if (!yearlyPrice) {
    yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: YEARLY_CENTS,
      currency: 'usd',
      recurring: { interval: 'year' },
      metadata: { billing_cycle: 'yearly' },
    });
    console.log('Created yearly price:', yearlyPrice.id);
  } else {
    console.log('Using yearly price:', yearlyPrice.id);
  }

  const existingPromos = await stripe.promotionCodes.list({ limit: 100 });
  const promoByCode = new Map(
    existingPromos.data.map((p) => [String(p.code).toUpperCase(), p])
  );

  for (const percent of DISCOUNT_PERCENTS) {
    const code = `PHYGITALIZE${percent}`;
    if (promoByCode.has(code)) {
      console.log(`Promotion code ${code} already exists (${promoByCode.get(code).id})`);
      continue;
    }

    const coupon = await stripe.coupons.create({
      name: `Phygital ${percent}% off (12 months)`,
      percent_off: percent,
      duration: 'repeating',
      duration_in_months: 12,
      applies_to: { products: [product.id] },
      metadata: { phygital_promo_family: 'PHYGITALIZE' },
    });

    const promotionCode = await stripe.promotionCodes.create({
      promotion: { type: 'coupon', coupon: coupon.id },
      code,
      active: true,
      metadata: { percent_off: String(percent) },
    });

    console.log(`Created ${code} → coupon ${coupon.id}, promo ${promotionCode.id}`);
  }

  console.log('\n--- Add to server/.env ---\n');
  console.log(`STRIPE_PRODUCT_PHYGITAL_QR=${product.id}`);
  console.log(`STRIPE_PRICE_PHYGITAL_QR_MONTHLY=${monthlyPrice.id}`);
  console.log(`STRIPE_PRICE_PHYGITAL_QR_YEARLY=${yearlyPrice.id}`);
  console.log('\nWebhook (local): stripe listen --forward-to localhost:5000/api/billing/webhook');
  console.log('Then set STRIPE_WEBHOOK_SECRET=whsec_... from CLI output.\n');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
