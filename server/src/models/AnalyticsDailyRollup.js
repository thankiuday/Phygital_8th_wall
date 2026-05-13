'use strict';

const mongoose = require('mongoose');

/**
 * Pre-aggregated scan counts per calendar day (UTC). Updated from the scan
 * pipeline (`scanQueue.normalizeAndPersist`). Used to accelerate scan trend
 * series when `timezone=UTC` (see `analyticsRollupService`).
 */
const analyticsDailyRollupSchema = new mongoose.Schema(
  {
    rollupScope: {
      type: String,
      enum: ['user', 'campaign'],
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
      index: true,
    },
    /** `YYYY-MM-DD` in UTC — matches `fillDailySeries` when timezone is UTC. */
    dateUtc: { type: String, required: true, maxlength: 10 },
    scans: { type: Number, default: 0 },
    /**
     * Capped unique visitor hashes for the day (approximation when traffic is high).
     * `uniqueScans` in the API is derived from `$size` after each bump.
     */
    visitorHashes: { type: [String], default: [] },
    uniqueScansApprox: { type: Number, default: 0 },
  },
  { timestamps: false }
);

analyticsDailyRollupSchema.index(
  { rollupScope: 1, userId: 1, dateUtc: 1 },
  { unique: true, partialFilterExpression: { rollupScope: 'user' } }
);
analyticsDailyRollupSchema.index(
  { rollupScope: 1, campaignId: 1, dateUtc: 1 },
  { unique: true, partialFilterExpression: { rollupScope: 'campaign' } }
);

module.exports = mongoose.model('AnalyticsDailyRollup', analyticsDailyRollupSchema);
