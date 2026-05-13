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
        values: [
          'ar-card',
          'single-link-qr',
          'multiple-links-qr',
          'links-video-qr',
          'links-doc-video-qr',
          'digital-business-card',
        ],
        message:
          'campaignType must be one of: ar-card, single-link-qr, multiple-links-qr, links-video-qr, links-doc-video-qr, digital-business-card',
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

    /**
     * Denormalized owner handle + per-owner-unique hub segment for vanity URLs
     * `CLIENT_URL/open/{ownerHandle}/{hubSlug}`. Immutable after creation.
     */
    ownerHandle: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 30,
      immutable: true,
      index: true,
    },
    hubSlug: {
      type: String,
      default: null,
      trim: true,
      lowercase: true,
      maxlength: 60,
      immutable: true,
      index: true,
    },

    /**
     * When true, printed QR targets the SPA `/open/:slug` bridge so the visitor
     * can opt in to navigator.geolocation before redirect (requires CLIENT_URL).
     */
    preciseGeoAnalytics: { type: Boolean, default: false },

    /**
     * Hub links for `multiple-links-qr` and `links-video-qr` — resolved hrefs
     * are built server-side for public meta and click validation.
     */
    linkItems: {
      type: [
        {
          linkId: { type: String, required: true },
          kind: { type: String, required: true },
          label: { type: String, required: true, maxlength: 80 },
          value: { type: String, required: true, maxlength: 500 },
        },
      ],
      default: undefined,
    },

    /**
     * Hero-video source for `links-video-qr`. `'upload'` → reuse `videoUrl`
     * (Cloudinary CDN). `'link'` → store the original public URL on
     * `externalVideoUrl`; the public meta endpoint resolves a sandboxed
     * iframe src via `toEmbedSrc()`.
     *
     * Also doubles as the campaign-wide source mode for `links-doc-video-qr`
     * (all `videoItems[]` share this mode).
     */
    videoSource: {
      type: String,
      enum: ['upload', 'link'],
      default: null,
    },
    externalVideoUrl: {
      type: String,
      default: null,
      trim: true,
      maxlength: [2048, 'externalVideoUrl cannot exceed 2048 characters'],
    },

    /**
     * Multi-video items for `links-doc-video-qr`. Each entry follows the same
     * source contract as the single-video `links-video-qr` campaign so a
     * Cloudinary publicId is always tracked when the user uploaded the asset
     * (needed for delete cleanup).
     */
    videoItems: {
      type: [
        {
          videoId: { type: String, required: true },
          label: { type: String, required: true, maxlength: 80, trim: true },
          source: { type: String, enum: ['upload', 'link'], required: true },
          url: { type: String, default: null, maxlength: 2048, trim: true },
          publicId: { type: String, default: null, maxlength: 256 },
          externalVideoUrl: { type: String, default: null, maxlength: 2048, trim: true },
          thumbnailUrl: { type: String, default: null, maxlength: 2048, trim: true },
        },
      ],
      default: undefined,
      validate: {
        validator(value) {
          if (!Array.isArray(value)) return true;
          return value.length <= 5;
        },
        message: 'videoItems cannot exceed 5 entries',
      },
    },

    /**
     * Document items for `links-doc-video-qr`. Cloudinary `raw` resource
     * stores Office docs / PDFs; `publicId` lets the delete handler clean
     * up assets at campaign-delete time.
     */
    docItems: {
      type: [
        {
          docId: { type: String, required: true },
          label: { type: String, required: true, maxlength: 80, trim: true },
          url: { type: String, required: true, maxlength: 2048, trim: true },
          publicId: { type: String, default: null, maxlength: 256 },
          mimeType: { type: String, default: null, maxlength: 128 },
          bytes: { type: Number, default: 0, min: 0 },
          resourceType: {
            type: String,
            enum: ['raw', 'image'],
            default: 'raw',
          },
          addedAt: { type: Date, default: Date.now },
        },
      ],
      default: undefined,
      validate: {
        validator(value) {
          if (!Array.isArray(value)) return true;
          return value.length <= 5;
        },
        message: 'docItems cannot exceed 5 entries',
      },
    },

    /* ── digital-business-card fields ──────────────────────────────────────
     * Editable, user-owned content / design / print preferences for the
     * card hub at /card/:cardSlug. Stored as Mixed so rich nested shapes
     * (sections, gallery rows, etc.) stay flexible — the public surface is
     * strictly validated by Zod at the edge.
     * ────────────────────────────────────────────────────────────────────── */
    cardSlug: {
      type: String,
      // Important: keep this undefined (not null). With a sparse+unique index,
      // `null` is still indexed and causes duplicate key errors on non-card
      // campaigns that don't use cardSlug.
      default: undefined,
      index: { unique: true, sparse: true },
      // Kebab-case, 3–60 chars; validated server-side at Zod edge too.
      match: [/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/, 'cardSlug must be kebab-case (3-60 chars)'],
      lowercase: true,
      trim: true,
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    cardContent: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    cardDesign: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    cardPrintSettings: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },

    /* ── Soft delete ──────────────────────────────────────────────────────
     * All read paths add `isDeleted: { $ne: true }` to their match. A daily
     * cron purges Cloudinary assets and hard-deletes after a grace period.
     * ────────────────────────────────────────────────────────────────────── */
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },

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
      /** Denormalized per-linkId click counts for multiple-links-qr (see $inc on click). */
      linkClickTotals: { type: mongoose.Schema.Types.Mixed, default: undefined },
      /** Denormalized per-docId open counts for links-doc-video-qr. */
      docOpenTotals: { type: mongoose.Schema.Types.Mixed, default: undefined },
      /** Denormalized per-videoId play counts for links-doc-video-qr. */
      videoPlayTotals: { type: mongoose.Schema.Types.Mixed, default: undefined },
      /** Denormalized per-action click counts for digital-business-card. */
      cardActionTotals: { type: mongoose.Schema.Types.Mixed, default: undefined },
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
// Soft-delete-aware list index: powers `My active <type> campaigns, newest first`.
campaignSchema.index({ userId: 1, isDeleted: 1, campaignType: 1, updatedAt: -1 });
campaignSchema.index(
  { ownerHandle: 1, hubSlug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      ownerHandle: { $exists: true, $type: 'string', $nin: [null, ''] },
      hubSlug: { $exists: true, $type: 'string', $nin: [null, ''] },
    },
  }
);

const Campaign = mongoose.model('Campaign', campaignSchema);
module.exports = Campaign;
