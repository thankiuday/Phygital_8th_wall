import axios from 'axios';
import { getToken, doLogout, setToken } from './tokenBridge';

/**
 * api — base Axios instance.
 *
 * Access token is read from the tokenBridge (set by useAuthStore on mount).
 * On 401, the interceptor silently calls /auth/refresh, updates the store
 * via the bridge, then retries the original request once.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL;
const shouldForceRemoteInDev = import.meta.env.VITE_USE_REMOTE_API === 'true';
const baseURL =
  import.meta.env.DEV && !shouldForceRemoteInDev
    ? '/api'
    : (configuredApiUrl || '/api');

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // sends httpOnly refresh cookie automatically
});

/** Some proxies return JSON as a string, or HTML as “JSON”. Normalize before handlers run. */
const normalizeResponseData = (data) => {
  if (typeof data !== 'string') return data;
  const t = data.trim();
  if (!t) return null;
  if (t.startsWith('<')) return data;
  try {
    return JSON.parse(t);
  } catch {
    return data;
  }
};

/** Avoid refresh-on-401 for the refresh call itself (prevents deadlock / double logout). */
const isFailedAuthRefreshRequest = (config) => {
  if (!config) return false;
  if (config.skipAuthRefresh === true) return true;
  const url = typeof config.url === 'string' ? config.url : '';
  return url.includes('/auth/refresh');
};

/* ── Request interceptor — attach access token ──────────────────── */
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Response interceptor — silent refresh on 401 ───────────────── */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => {
    const d = normalizeResponseData(res.data);
    if (typeof d === 'string' && d.trim().startsWith('<')) {
      return Promise.reject(
        Object.assign(
          new Error(
            'API returned HTML instead of JSON. In production, set VITE_API_URL to your backend origin (e.g. https://your-api.onrender.com/api).'
          ),
          { isBadApiResponse: true }
        )
      );
    }
    res.data = d;
    return res;
  },
  async (error) => {
    const orig = error.config;

    if (error.response?.status === 401 && isFailedAuthRefreshRequest(orig)) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !orig._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then((token) => {
            orig.headers.Authorization = `Bearer ${token}`;
            return api(orig);
          });
      }

      orig._retry = true;
      isRefreshing = true;

      try {
        const res = await api.post('/auth/refresh', null, { skipAuthRefresh: true });
        const inner = res?.data?.data;
        const newToken = inner && typeof inner === 'object' ? inner.accessToken : null;
        if (!newToken || typeof newToken !== 'string') {
          throw new Error('Refresh returned no access token');
        }
        setToken(newToken);
        processQueue(null, newToken);
        orig.headers.Authorization = `Bearer ${newToken}`;
        return api(orig);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        doLogout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
