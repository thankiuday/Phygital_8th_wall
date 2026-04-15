import api from './api';

export const adminService = {
  getStats: async () => {
    const { data } = await api.get('/admin/stats');
    return data.data;
  },

  getUsers: async (params = {}) => {
    const { data } = await api.get('/admin/users', { params });
    return data.data;
  },

  updateUser: async (id, updates) => {
    const { data } = await api.patch(`/admin/users/${id}`, updates);
    return data.data.user;
  },

  getCampaigns: async (params = {}) => {
    const { data } = await api.get('/admin/campaigns', { params });
    return data.data;
  },

  updateCampaign: async (id, updates) => {
    const { data } = await api.patch(`/admin/campaigns/${id}`, updates);
    return data.data.campaign;
  },
};
