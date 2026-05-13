'use strict';

/** Kebab slug for hub path segment (campaign leg), 3–60 chars. */
const HUB_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

const slugifyCampaignName = (name) => {
  const base = String(name || 'campaign')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (base.length >= 3) return base;
  return 'campaign';
};

/**
 * Unique hub path segment per owner (`userId`). Mutually exclusive with
 * other campaigns of the same user (soft-deleted rows ignored).
 */
const allocateUniqueHubSlugForUser = async (CampaignModel, userId, campaignName) => {
  let base = slugifyCampaignName(campaignName);
  if (!HUB_SLUG_RE.test(base)) base = 'campaign';

  for (let i = 0; i < 150; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`.slice(0, 60);
    if (!HUB_SLUG_RE.test(candidate)) continue;
    const exists = await CampaignModel.exists({
      userId,
      hubSlug: candidate,
      isDeleted: { $ne: true },
    });
    if (!exists) return candidate;
  }

  const { nanoid } = await import('nanoid');
  for (let j = 0; j < 20; j += 1) {
    const suffix = nanoid(6).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) || 'x';
    const candidate = `${base.slice(0, 40)}-${suffix}`.slice(0, 60);
    if (!HUB_SLUG_RE.test(candidate)) continue;
    if (!await CampaignModel.exists({
      userId,
      hubSlug: candidate,
      isDeleted: { $ne: true },
    })) return candidate;
  }
  throw new Error('Could not allocate hub slug');
};

module.exports = {
  HUB_SLUG_RE,
  slugifyCampaignName,
  allocateUniqueHubSlugForUser,
};
