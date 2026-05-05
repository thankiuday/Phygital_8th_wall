'use strict';

const mongoose = require('mongoose');

/**
 * VideoPlayEvent — one document per visitor + video on the
 * `links-doc-video-qr` hub.
 *
 * The single-video `links-video-qr` flow already tracks engagement via
 * `ScanEvent.videoPlayed` / `videoWatchedSec` / `videoWatchPercent`. That
 * rollup is too coarse for multi-video pages where we want per-video
 * play counts and watch percent buckets. We keep this in its own
 * collection so per-video aggregations stay cheap and the existing
 * `ScanEvent` shape is unchanged.
 *
 * Upserted by `POST /api/public/multi-link/:slug/video` on `play` /
 * `progress` / `ended` beacons.
 */
const videoPlayEventSchema = new mongoose.Schema(
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
    videoId: { type: String, required: true },
    visitorHash: { type: String, default: null, index: true },
    watchedSec: { type: Number, default: 0, min: 0 },
    watchPercent: { type: Number, default: 0, min: 0, max: 100 },
    occurredAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

videoPlayEventSchema.index({ campaignId: 1, occurredAt: -1 });
videoPlayEventSchema.index({ campaignId: 1, videoId: 1, occurredAt: -1 });
// Each visitor only contributes a single row per (campaign, video) so the
// aggregation surface stays bounded; the public endpoint upserts on this key.
videoPlayEventSchema.index(
  { campaignId: 1, videoId: 1, visitorHash: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model('VideoPlayEvent', videoPlayEventSchema);
