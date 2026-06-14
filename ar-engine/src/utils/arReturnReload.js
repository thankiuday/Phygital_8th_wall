/**
 * arReturnReload — durable "reload when user returns from an external link".
 *
 * Mobile browsers often restore a frozen AR tab from bfcache without firing
 * visibilitychange, or they lose in-memory flags. sessionStorage survives
 * those transitions; pairing it with a per-load sessionId avoids reloading
 * on unrelated future visits to the same campaign URL.
 */

const storageKey = (campaignId) => `ar_return_${campaignId}`;

export const createArSessionId = () =>
  `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const markReturnReload = (campaignId, sessionId) => {
  if (!campaignId || !sessionId) return;
  try {
    sessionStorage.setItem(storageKey(campaignId), sessionId);
  } catch {
    // Private mode / quota — best-effort only.
  }
};

export const hasPendingReturnReload = (campaignId, sessionId) => {
  if (!campaignId || !sessionId) return false;
  try {
    return sessionStorage.getItem(storageKey(campaignId)) === sessionId;
  } catch {
    return false;
  }
};

export const consumeReturnReload = (campaignId, sessionId) => {
  if (!hasPendingReturnReload(campaignId, sessionId)) return false;
  try {
    sessionStorage.removeItem(storageKey(campaignId));
  } catch {
    // ignore
  }
  window.location.reload();
  return true;
};

/**
 * Register global listeners as early as possible (before MindAR boot) so a
 * return from a social tab during/after startup still triggers a reload.
 */
export const registerReturnReloadHandlers = (campaignId, sessionId) => {
  const tryReload = () => {
    if (document.visibilityState === 'hidden') return;
    consumeReturnReload(campaignId, sessionId);
  };

  document.addEventListener('visibilitychange', tryReload);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      window.location.reload();
      return;
    }
    tryReload();
  });
  window.addEventListener('focus', tryReload);
};
