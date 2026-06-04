import api from './api';

const unwrap = (res, action) => {
  const body = res?.data;
  if (!body?.success) {
    throw new Error(body?.message || `${action} failed`);
  }
  return body.data;
};

export const billingService = {
  getStatus: async () => {
    const res = await api.get('/billing/status');
    return unwrap(res, 'Billing status');
  },

  createCheckoutSession: async ({ billingCycle = 'monthly' } = {}) => {
    const res = await api.post('/billing/checkout-session', { billingCycle });
    return unwrap(res, 'Checkout');
  },

  createPortalSession: async () => {
    const res = await api.post('/billing/portal');
    return unwrap(res, 'Billing portal');
  },
};
