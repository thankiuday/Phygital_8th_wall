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
});

export default publicApi;
