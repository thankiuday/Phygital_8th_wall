'use strict';

const mongoose = require('mongoose');

/**
 * Type-aware required validators.
 *
 * The Campaign model is a *discriminator-by-field* (`campaignType`) rather than
 * Mongoose discriminators because we want a single shared collection and minimal
 * schema duplication.  Required fields per type are enforced via `validate`
 * functions that read the sibling `campaignType` from `this`.
 */
const requiredForType = (type, message) => ({
  validator(value) {
    if (this.campaignType !== type) return true;
    return value !== null && value !== undefined && value !== '';
  },
  message,
});

const campaignSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    campaignName: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: [100, 'Campaign name cannot exceed 100 characters'],
    },

    /**
     * campaignType — discriminator field.
     * Drives type-specific required validators below and route logic in the
     * redirect endpoint.  New types can be added without breaking older docs
     * because `default: 'ar-card'` keeps existing AR campaigns valid.
     */
    campaignType: {
      type: String,
      enum: {
        values: ['ar-card', 'single-link-qr'],
        message: 'campaignType must be one of: ar-card, single-link-qr',
      },
      default: 'ar-card',
      required: true,
      index: true,
    },

    // ── AR card fields (required only when campaignType === 'ar-card') ──
    targetImageUrl: {
      type: String,
      default: null,
      validate: requiredForType('ar-card', 'targetImageUrl is required for ar-card campaigns'),
    },
    targetImagePublicId: { type: String, default: null },

    videoUrl: {
      type: String,
      default: null,
      validate: requiredForType('ar-card', 'videoUrl is required for ar-card campaigns'),
    },
    videoPublicId: { type: String, default: null },

    // Auto-generated QR code (AR campaigns only — single-link uses qrDesign instead)
    qrCodeUrl: { type: String, default: null },
    qrPublicId: { type: String, default: null },

    // ── Single-link Dynamic QR fields ────────────────────────────────────
    /**
     * destinationUrl — where /r/:slug 302-redirects to.
     * Only required for `single-link-qr`.  Validated upstream by Zod
     * (safeUrl helper) before reaching Mongoose.
     */
    destinationUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2048, 'destinationUrl cannot exceed 2048 characters'],
      validate: requiredForType('single-link-qr', 'destinationUrl is required for single-link-qr campaigns'),
    },

    /**
     * qrDesign — opaque JSON consumed by `qr-code-styling` on the client.
     * Strictly validated by Zod at the edge (no z.any allowed).  Stored as
     * Mixed because the shape evolves with the QR styling library and we
     * never query into individual sub-fields.
     */
    qrDesign: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /**
     * redirectSlug — short, opaque, URL-safe id used in the printed QR.
     * 8-char nanoid; sparse so AR campaigns (which don't have one) don't
     * collide on the unique index.  Immutable after creation.
     */
    redirectSlug: {
      type: String,
      default: null,
      index: { unique: true, sparse: true },
      immutable: true,
    },

    status: {
      type: String,
      enum: ['draft', 'active', 'paused'],
      default: 'draft',
      index: true,
    },

    analytics: {
      totalScans: { type: Number, default: 0 },
      uniqueScans: { type: Number, default: 0 },
      lastScannedAt: { type: Date, default: null },
    },

    thumbnailUrl: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    // In production we never let Mongoose touch indexes at boot — run
    // `Campaign.syncIndexes()` from a one-off migration script instead.
    autoIndex: process.env.NODE_ENV !== 'production',
  }
);

/* ── Indexes for common dashboard queries ──────────────────────── */
campaignSchema.index({ userId: 1, createdAt: -1 });
campaignSchema.index({ userId: 1, status: 1 });
// Compound index supports the typical list query: my campaigns of a given
// type and status, newest first (used by CampaignsListPage filters).
campaignSchema.index({ userId: 1, campaignType: 1, status: 1, createdAt: -1 });

const Campaign = mongoose.model('Campaign', campaignSchema);
module.exports = Campaign;
