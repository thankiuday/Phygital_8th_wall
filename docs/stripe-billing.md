# Stripe billing (Phygital QR + PHYGITALIZE promos)

## One-time Stripe catalog setup

From `server/` with `STRIPE_SECRET_KEY` in `.env`:

```bash
npm run stripe-setup
```

This creates (or reuses) the **Phygital QR** product, **$14.99/mo** and **$149/yr** prices, and promotion codes **PHYGITALIZE10** through **PHYGITALIZE70** (10–70% off, repeating 12 months, product-scoped).

Copy the printed `STRIPE_PRODUCT_*` and `STRIPE_PRICE_*` lines into `server/.env`.

## Environment variables

### Server (`server/.env` + Render API service)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` from Dashboard or Stripe CLI |
| `STRIPE_PRICE_PHYGITAL_QR_MONTHLY` | `price_...` |
| `STRIPE_PRICE_PHYGITAL_QR_YEARLY` | `price_...` |
| `STRIPE_PRODUCT_PHYGITAL_QR` | Optional `prod_...` (setup script) |

### Client (build-time)

| Variable | Description |
|----------|-------------|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` (optional; hosted Checkout does not require it on the client) |

## Local webhooks

```bash
stripe listen --forward-to localhost:5000/api/billing/webhook
```

Set `STRIPE_WEBHOOK_SECRET` to the signing secret the CLI prints.

## Production webhook

In [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks), add:

- **URL:** `https://phygital8thwall-api.onrender.com/api/billing/webhook`
- **Events:** `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`

## Two coupon systems

| System | Codes | Where used |
|--------|-------|------------|
| MongoDB admin coupons | Created in Admin → Coupons | Profile → Coupon & access (100% free) |
| Stripe promotion codes | PHYGITALIZE10–70 | Stripe Checkout promo field when subscribing |

Do not create `PHYGITALIZE*` codes in the admin coupon UI.

## Customer portal

Enable [Billing Portal](https://dashboard.stripe.com/settings/billing/portal) in test mode so users can cancel or update payment methods from **Dashboard → Settings**.
