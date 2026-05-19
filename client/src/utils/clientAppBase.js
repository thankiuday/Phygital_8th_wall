/**
 * SPA origin for /open/…, /l/…, and QR preview URLs.
 * In local dev, use the current tab (localhost) unless VITE_USE_REMOTE_API forces production URLs.
 */
export const resolveClientAppBase = () => {
  const forceRemote = import.meta.env.VITE_USE_REMOTE_API === 'true';
  const fromEnv =
    import.meta.env.VITE_APP_URL && String(import.meta.env.VITE_APP_URL).replace(/\/$/, '');

  if (import.meta.env.DEV && !forceRemote && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  if (fromEnv) return fromEnv;
  return typeof window !== 'undefined' ? window.location.origin : '';
};
