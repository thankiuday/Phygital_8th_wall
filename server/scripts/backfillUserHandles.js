'use strict';

/**
 * One-off: assign unique `handle` to every User missing one (derived from email).
 *
 * Usage (from server/):  node scripts/backfillUserHandles.js
 * Requires MONGO_URI in environment (.env loaded via dotenv).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const { allocateUniqueHandleFromEmail } = require('../src/utils/userHandle');

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is required');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const cursor = User.find({ $or: [{ handle: null }, { handle: { $exists: false } }] })
    .select('email')
    .cursor();
  let n = 0;
  for await (const u of cursor) {
    const handle = await allocateUniqueHandleFromEmail(User, u.email);
    await User.collection.updateOne({ _id: u._id }, { $set: { handle } });
    n += 1;
    if (n % 50 === 0) console.info(`… ${n} users`);
  }
  console.info(`Done. Assigned handle to ${n} user(s).`);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
