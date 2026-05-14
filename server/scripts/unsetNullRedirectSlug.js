'use strict';

/**
 * One-off: remove redirectSlug where it was stored as null (legacy + default:null).
 * Those rows still occupy the sparse-unique index "null" slot and block new AR
 * campaigns until cleaned. Safe: dynamic-QR campaigns always have a string slug.
 *
 * Usage (from repo root):
 *   cd server && node scripts/unsetNullRedirectSlug.js
 *
 * Requires MONGO_URI in .env (same as the API).
 */

require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const col = mongoose.connection.collection('campaigns');
  const res = await col.updateMany({ redirectSlug: null }, { $unset: { redirectSlug: '' } });
  console.log('Matched:', res.matchedCount, 'Modified:', res.modifiedCount);
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
