import api from './api';

/**
 * Expects `{ success, message, data }` from our API. Avoids crashes when `data`
 * is null/omitted (misconfigured base URL, empty body, or non-JSON proxy).
 */
const requireAuthPayload = (res, action) => {
  const body = res?.data;
  if (body == null || typeof body !== 'object') {
    throw new Error(
      `Invalid response from server (${action}). Check VITE_API_URL points to your API (…/api).`
    );
  }
  let inner = body.data;
  if (inner == null) {
    throw new Error(body.message || `${action} failed: empty data from server.`);
  }
  if (typeof inner === 'string') {
    try {
      inner = JSON.parse(inner);
    } catch {
      throw new Error(body.message || `${action} failed: could not parse server data.`);
    }
  }
  if (typeof inner !== 'object') {
    throw new Error(body.message || `${action} failed: invalid payload.`);
  }
  return inner;
};

/**
 * authService — all auth-related API calls.
 * All methods return the `data` property of the server response.
 */
export const authService = {
  register: async (payload) => {
    const res = await api.post('/auth/register', payload);
    const data = requireAuthPayload(res, 'Register');
    if (!data.accessToken || !data.user) {
      throw new Error('Registration response missing token or user.');
    }
    return data;
  },

  login: async (payload) => {
    const res = await api.post('/auth/login', payload);
    const data = requireAuthPayload(res, 'Login');
    if (!data.accessToken || !data.user) {
      throw new Error('Login response missing token or user.');
    }
    return data;
  },

  logout: async () => {
    await api.post('/auth/logout');
  },

  logoutAll: async () => {
    await api.post('/auth/logout-all');
  },

  /**
   * refresh — uses the httpOnly cookie automatically (withCredentials: true).
   * Returns { accessToken }.
   */
  refresh: async () => {
    const res = await api.post('/auth/refresh');
    const data = requireAuthPayload(res, 'Refresh');
    if (!data.accessToken) {
      throw new Error('Refresh response missing access token.');
    }
    return data;
  },

  getMe: async (token) => {
    const res = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = requireAuthPayload(res, 'getMe');
    if (!data.user) {
      throw new Error('Profile response missing user.');
    }
    return data;
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
