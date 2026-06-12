import api from './api';

export const SLA_MESSAGE =
  'Your AR card request was received. Our team will configure it within 24 hours.';

export const SLA_SUBTEXT = 'Processing — up to 24 hours';

export const arServiceRequestService = {
  createRequest: async (payload, { replaceOpen = false } = {}) => {
    const { data } = await api.post('/ar-service-requests', {
      ...payload,
      ...(replaceOpen ? { replaceOpen: true } : {}),
    });
    return data.data;
  },

  cancelRequest: async (id) => {
    const { data } = await api.post(`/ar-service-requests/${id}/cancel`);
    return data.data;
  },

  listMyRequests: async (params = {}) => {
    const { data } = await api.get('/ar-service-requests', { params });
    return data.data;
  },

  getMyRequest: async (id) => {
    const { data } = await api.get(`/ar-service-requests/${id}`);
    return data.data;
  },
};
