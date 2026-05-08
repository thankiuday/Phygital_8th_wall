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

    // Geo (approximate — from IP geolocation)
    country: { type: String, default: null },
    region: { type: String, default: null },
    city: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    /** Approximate IP geo vs browser GPS vs both */
    geoSource: {
      type: String,
      enum: ['ip', 'browser', 'hybrid'],
      default: 'ip',
    },
    /** Meters — meaningful when geoSource is browser or hybrid */
    locationAccuracyM: { type: Number, default: null },
    /** Client-reported consent banner version when GPS coordinates are stored */
    geoConsentVersion: { type: String, default: null, maxlength: 128 },

    // Engagement
    sessionDurationMs: { type: Number, default: 0 },
    /** Whether the visitor played the hero video at least once in this session. */
    videoPlayed: { type: Boolean, default: false, index: true },
    /** Maximum playback position reached in seconds (per visitor session). */
    videoWatchedSec: { type: Number, default: 0, min: 0 },
    videoWatchPercent: { type: Number, default: 0, min: 0, max: 100 },

    scannedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

scanEventSchema.index({ userId: 1, scannedAt: -1 });
scanEventSchema.index({ campaignId: 1, scannedAt: -1 });
scanEventSchema.index({ campaignId: 1, videoPlayed: 1 });

/**
 * Retention TTL — expires raw scan rows after `ANALYTICS_RETENTION_DAYS`
 * (default 365). Aggregated dashboard counters on Campaign.analytics.* are
 * not affected; only the raw event collection is trimmed.
 */
const RETENTION_DAYS = Math.max(
  30,
  Number(process.env.ANALYTICS_RETENTION_DAYS) || 365
);
scanEventSchema.index(
  { scannedAt: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60, name: 'scannedAt_ttl' }
);

const ScanEvent = mongoose.model('ScanEvent', scanEventSchema);
module.exports = ScanEvent;
