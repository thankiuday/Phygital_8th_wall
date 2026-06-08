const STATUS_LABELS = {
  active: 'Active',
  trialing: 'Trial',
  past_due: 'Past due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
  incomplete: 'Incomplete',
  incomplete_expired: 'Expired',
  paused: 'Paused',
};

export const formatSubscriptionStatus = (status) => {
  if (!status) return null;
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
};

export const formatBillingDate = (value) => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

export const formatMoneyFromCents = (cents, currency = 'usd') => {
  if (cents == null || Number.isNaN(Number(cents))) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: String(currency).toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(cents) / 100);
};

export const billingCycleLabel = (cycle) => {
  if (cycle === 'yearly') return 'Yearly';
  if (cycle === 'monthly') return 'Monthly';
  return null;
};

const SUBSCRIPTION_USER_FIELDS = [
  'plan',
  'effectivePlan',
  'hasPhygitalQrAccess',
  'subscriptionStatus',
  'subscriptionPriceId',
  'promotionCodeUsed',
  'currentPeriodStart',
  'currentPeriodEnd',
  'billingCycle',
  'billingAmountCents',
  'billingCurrency',
  'billingPriceLabel',
  'isSubscriptionActive',
  'cancelAtPeriodEnd',
  'stripeCustomerId',
];

export const subscriptionPatchFromBilling = (billing) => {
  if (!billing) return null;
  const patch = {};
  SUBSCRIPTION_USER_FIELDS.forEach((key) => {
    if (billing[key] !== undefined) patch[key] = billing[key];
  });
  return Object.keys(patch).length ? patch : null;
};

export const hasActivePhygitalAccess = (user, billing) =>
  !!(
    user?.hasPhygitalQrAccess ||
    user?.hasFullAccess ||
    billing?.hasPhygitalQrAccess ||
    billing?.isSubscriptionActive
  );
