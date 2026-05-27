'use strict';

/**
 * Smoke test: create AR service request doc (no HTTP).
 * Run: node scripts/test-ar-service-request.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const ArCardServiceRequest = require('../src/models/ArCardServiceRequest');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ role: 'user' }) || await User.findOne();
  if (!user) throw new Error('No user in DB');

  const req = await ArCardServiceRequest.create({
    userId: user._id,
    status: 'submitted',
    targetImageUrl: 'https://example.com/card.jpg',
    qrPlacement: { x: 0.82, y: 0.82, scale: 0.26, preset: 'bottom-right' },
    greenscreenVideoUrl: 'https://example.com/greenscreen.mp4',
    linkItems: [{ linkId: 'testlink123', kind: 'website', label: 'Site', value: 'https://example.com' }],
    submittedAt: new Date(),
  });

  console.log('Created request:', req._id.toString(), 'for', user.email);
  await ArCardServiceRequest.deleteOne({ _id: req._id });
  console.log('Cleaned up. Smoke test passed.');
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  mongoose.disconnect().finally(() => process.exit(1));
});
