'use strict';

const SUBSCRIPTION_EXPAND = ['items.data.price'];

const subscriptionIdFrom = (subscription) => {
  if (!subscription) return null;
  if (typeof subscription === 'string') return subscription;
  return subscription.id || null;
};

const firstSubscriptionItem = (subscription) => subscription?.items?.data?.[0] || null;

const priceIdFromSubscription = (subscription) => {
  const item = firstSubscriptionItem(subscription);
  const priceRef = item?.price ?? item?.plan;
  if (typeof priceRef === 'string') return priceRef;
  return priceRef?.id || null;
};

const unixToDate = (seconds) => {
  if (seconds == null || Number.isNaN(Number(seconds))) return null;
  return new Date(Number(seconds) * 1000);
};

const periodDatesFromSubscription = (subscription) => {
  const item = firstSubscriptionItem(subscription);
  const start =
    subscription?.current_period_start ?? item?.current_period_start ?? null;
  const end = subscription?.current_period_end ?? item?.current_period_end ?? null;
  return {
    currentPeriodStart: unixToDate(start),
    currentPeriodEnd: unixToDate(end),
  };
};

const retrieveSubscriptionForSync = async (stripe, subscriptionOrId) => {
  const subId = subscriptionIdFrom(subscriptionOrId);
  if (!stripe || !subId) return null;
  return stripe.subscriptions.retrieve(subId, { expand: SUBSCRIPTION_EXPAND });
};

const findActiveSubscriptionForCustomer = async (stripe, customerId) => {
  if (!stripe || !customerId) return null;

  for (const status of ['active', 'trialing']) {
    const { data } = await stripe.subscriptions.list({
      customer: customerId,
      status,
      limit: 1,
      expand: ['data.items.data.price'],
    });
    if (data[0]) return data[0];
  }
  return null;
};

module.exports = {
  SUBSCRIPTION_EXPAND,
  subscriptionIdFrom,
  priceIdFromSubscription,
  periodDatesFromSubscription,
  retrieveSubscriptionForSync,
  findActiveSubscriptionForCustomer,
};
