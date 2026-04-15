import api from './api';

/**
 * authService — all auth-related API calls.
 * All methods return the `data` property of the server response.
 */
export const authService = {
  register: async (payload) => {
    const res = await api.post('/auth/register', payload);
    return res.data.data;
  },

  login: async (payload) => {
    const res = await api.post('/auth/login', payload);
    return res.data.data;
  },

  logout: async () => {
    await api.post('/auth/logout');
  },

  /**
   * refresh — uses the httpOnly cookie automatically (withCredentials: true).
   * Returns { accessToken }.
   */
  refresh: async () => {
    const res = await api.post('/auth/refresh');
    return res.data.data;
  },

  getMe: async (token) => {
    const res = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data.data;
  },

  forgotPassword: async (email) => {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  resetPassword: async (token, password, confirmPassword) => {
    const res = await api.post(`/auth/reset-password/${token}`, { password, confirmPassword });
    return res.data;
  },
};
