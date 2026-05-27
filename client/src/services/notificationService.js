import api from './api';

export const notificationService = {
  list: async (params = {}) => {
    const { data } = await api.get('/notifications', { params });
    return data.data;
  },

  markRead: async (id) => {
    const { data } = await api.patch(`/notifications/${id}/read`);
    return data.data;
  },

  markAllRead: async () => {
    const { data } = await api.patch('/notifications/read-all');
    return data.data;
  },
};
