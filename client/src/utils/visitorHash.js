/**
 * Shared visitor fingerprint for hub + AR on the same campaign (redirectSlug).
 */
export function getVisitorHashForCampaign(redirectSlug) {
  if (redirectSlug) {
    const key = `p8w_vh_${String(redirectSlug)}`;
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const hash = crypto.randomUUID?.()
      || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, hash);
    return hash;
  }

  const fallbackKey = 'p8w_vid';
  const stored = sessionStorage.getItem(fallbackKey);
  if (stored) return stored;
  const hash = crypto.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(fallbackKey, hash);
  return hash;
}
