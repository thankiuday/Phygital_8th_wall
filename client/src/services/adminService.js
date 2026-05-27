import api from './api';

export const adminService = {
  getStats: async () => {
    const { data } = await api.get('/admin/stats');
    return data.data;
  },

  getPlatformKPIs: async () => {
    const { data } = await api.get('/admin/analytics/platform');
    return data.data;
  },

  getSignupsTrend: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/signups-trend', { params: { days } });
    return data.data;
  },

  getScansTrend: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/scans-trend', { params: { days } });
    return data.data;
  },

  getCampaignTypeBreakdown: async () => {
    const { data } = await api.get('/admin/analytics/campaign-types');
    return data.data;
  },

  getDeviceBreakdown: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/devices', { params: { days } });
    return data.data;
  },

  getGeoBreakdown: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/geo', { params: { days } });
    return data.data;
  },

  getTopCampaigns: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/top-campaigns', { params: { days } });
    return data.data;
  },

  getEngagementStats: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/engagement', { params: { days } });
    return data.data;
  },

  getRetentionBreakdown: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/retention', { params: { days } });
    return data.data;
  },

  getHourlyHeatmap: async (days = 30) => {
    const { data } = await api.get('/admin/analytics/hourly-heatmap', { params: { days } });
    return data.data;
  },

  getUsers: async (params = {}) => {
    const { data } = await api.get('/admin/users', { params });
    return data.data;
  },

  getUserDetail: async (id) => {
    const { data } = await api.get(`/admin/users/${id}`);
    return data.data;
  },

  updateUser: async (id, updates) => {
    const { data } = await api.patch(`/admin/users/${id}`, updates);
    return data.data.user;
  },

  deleteUser: async (id) => {
    const { data } = await api.delete(`/admin/users/${id}`);
    return data;
  },

  resetUserPassword: async (id, newPassword) => {
    const { data } = await api.patch(`/admin/users/${id}/reset-password`, { newPassword });
    return data.data;
  },

  getCampaigns: async (params = {}) => {
    const { data } = await api.get('/admin/campaigns', { params });
    return data.data;
  },

  getCampaignDetail: async (id) => {
    const { data } = await api.get(`/admin/campaigns/${id}`);
    return data.data;
  },

  updateCampaign: async (id, updates) => {
    const { data } = await api.patch(`/admin/campaigns/${id}`, updates);
    return data.data.campaign;
  },

  getCoupons: async (params = {}) => {
    const { data } = await api.get('/admin/coupons', { params });
    return data.data;
  },

  createCoupon: async (payload) => {
    const { data } = await api.post('/admin/coupons', payload);
    return data.data.coupon;
  },

  updateCoupon: async (id, updates) => {
    const { data } = await api.patch(`/admin/coupons/${id}`, updates);
    return data.data.coupon;
  },

  deleteCoupon: async (id) => {
    const { data } = await api.delete(`/admin/coupons/${id}`);
    return data;
  },

  redeemCoupon: async (code) => {
    const { data } = await api.post('/coupons/redeem', { code });
    return data.data;
  },

  getArServiceRequests: async (params = {}) => {
    const { data } = await api.get('/admin/ar-service-requests', { params });
    return data.data;
  },

  getArServiceRequest: async (id) => {
    const { data } = await api.get(`/admin/ar-service-requests/${id}`);
    return data.data;
  },

  updateArServiceRequest: async (id, updates) => {
    const { data } = await api.patch(`/admin/ar-service-requests/${id}`, updates);
    return data.data;
  },

  fulfillArServiceRequest: async (id, payload) => {
    const { data } = await api.post(`/admin/ar-service-requests/${id}/fulfill`, payload);
    return data.data;
  },

  patchArCampaignAssets: async (campaignId, payload) => {
    const { data } = await api.patch(`/admin/campaigns/${campaignId}/ar-assets`, payload);
    return data.data;
  },
};
