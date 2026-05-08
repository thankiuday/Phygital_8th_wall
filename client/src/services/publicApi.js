import axios from 'axios';

/**
 * Anonymous requests to /api/public/* (no auth headers, no refresh loop).
 * Mirrors `api.js` base URL resolution for dev proxy vs production API host.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL;
const shouldForceRemoteInDev = import.meta.env.VITE_USE_REMOTE_API === 'true';
const baseURL =
  import.meta.env.DEV && !shouldForceRemoteInDev
    ? '/api'
    : (configuredApiUrl || '/api');

const publicApi = axios.create({
  baseURL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
  // Mirror `api.js`: avoid Axios auto-JSON parsing so malformed/plain-text
  // responses don't throw SyntaxError before call-sites can handle them.
  transformResponse: [(data) => data],
});

const normalizeResponseData = (data) => {
  if (typeof data !== 'string') return data;
  const trimmed = data.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('<')) return data;
  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
};

publicApi.interceptors.response.use((res) => {
  res.data = normalizeResponseData(res.data);
  return res;
});

export default publicApi;
