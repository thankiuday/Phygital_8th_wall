/**
 * Default name for the AR business-card wizard — unique per suggestion so
 * dashboard duplicates are unlikely. Uses display name, handle, or email local-part.
 */
export function suggestArCampaignName(user) {
  const raw =
    (typeof user?.name === 'string' && user.name.trim().split(/\s+/).filter(Boolean)[0]) ||
    (typeof user?.handle === 'string' && user.handle.trim().replace(/^@/, '')) ||
    (typeof user?.email === 'string' && user.email.split('@')[0]?.trim()) ||
    'My';
  const display = raw.replace(/[^\w\s-]/g, '').trim().slice(0, 40) || 'My';
  const rand = Math.random().toString(36).slice(2, 6);
  const suffix = `${Date.now().toString(36)}${rand}`.replace(/[^a-z0-9]/gi, '').slice(-8);
  const name = `${display}'s AR Card - ${suffix}`;
  return name.slice(0, 100);
}
