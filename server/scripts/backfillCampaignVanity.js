'use strict';

/**
 * One-off: set `ownerHandle` + `hubSlug` on hub-capable campaigns that predate
 * vanity URLs (mirrors create/duplicate allocation rules).
 *
 * Usage (from server/):  node scripts/backfillCampaignVanity.js
 * Requires MONGO_URI. Run `npm run backfill-handles` first if users lack `handle`.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Campaign = require('../src/models/Campaign');
const { allocateUniqueHandleFromEmail } = require('../src/utils/userHandle');
const { allocateUniqueHubSlugForUser } = require('../src/utils/campaignHubSlug');

const HUB_CAMPAIGN_TYPES = [
  'single-link-qr',
  'multiple-links-qr',
  'links-video-qr',
  'links-doc-video-qr',
  'digital-business-card',
];

const needsVanityFields = (c) => {
  const oh = c.ownerHandle;
  const hs = c.hubSlug;
  const missingOh = oh == null || oh === '';
  const missingHs = hs == null || hs === '';
  return missingOh || missingHs;
};

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const cursor = Campaign.find({
    campaignType: { $in: HUB_CAMPAIGN_TYPES },
    redirectSlug: { $exists: true, $nin: [null, ''] },
    isDeleted: { $ne: true },
  })
    .select('userId campaignName ownerHandle hubSlug')
    .cursor();

  let scanned = 0;
  let updated = 0;
  for await (const c of cursor) {
    scanned += 1;
    if (!needsVanityFields(c)) continue;

    const userDoc = await User.findById(c.userId).select('email handle').lean();
    if (!userDoc?.email) {
      console.warn(`Skip campaign ${c._id}: user ${c.userId} missing email`);
      continue;
    }

    let ownerHandle = userDoc.handle;
    if (!ownerHandle) {
      ownerHandle = await allocateUniqueHandleFromEmail(User, userDoc.email);
      await User.collection.updateOne({ _id: userDoc._id }, { $set: { handle: ownerHandle } });
    }

    const hubSlug = await allocateUniqueHubSlugForUser(
      Campaign,
      c.userId,
      String(c.campaignName || 'campaign').trim(),
    );

    await Campaign.collection.updateOne(
      { _id: c._id },
      { $set: { ownerHandle, hubSlug } },
    );
    updated += 1;
    if (updated % 50 === 0) console.info(`… updated ${updated} campaign(s)`);
  }

  console.info(`Done. Scanned ${scanned} campaign(s), assigned vanity fields to ${updated}.`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
