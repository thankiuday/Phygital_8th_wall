'use strict';

const mongoose = require('mongoose');

/**
 * ScanEvent — one document per individual AR scan.
 * Used by the analytics engine (Module 7) and aggregated for dashboard stats.
 */
const scanEventSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Fingerprint to count unique vs repeat visitors
    visitorHash: { type: String, index: true },

    // Device / browser info
    deviceType: { type: String, enum: ['mobile', 'tablet', 'desktop', 'unknown'], default: 'unknown' },
    browser: { type: String, default: 'unknown' },
    os: { type: String, default: 'unknown' },

    // Geo (approximate — from IP, filled in Module 7)
    country: { type: String, default: null },
    city: { type: String, default: null },

    // Engagement
    sessionDurationMs: { type: Number, default: 0 },
    videoWatchPercent: { type: Number, default: 0, min: 0, max: 100 },

    scannedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

scanEventSchema.index({ userId: 1, scannedAt: -1 });
scanEventSchema.index({ campaignId: 1, scannedAt: -1 });

const ScanEvent = mongoose.model('ScanEvent', scanEventSchema);
module.exports = ScanEvent;
