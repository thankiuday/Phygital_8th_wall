'use strict';

const mongoose = require('mongoose');

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

    // Cloudinary URLs — populated in Module 4
    targetImageUrl: { type: String, default: null },
    targetImagePublicId: { type: String, default: null },

    videoUrl: { type: String, default: null },
    videoPublicId: { type: String, default: null },

    // Auto-generated QR code
    qrCodeUrl: { type: String, default: null },
    qrPublicId: { type: String, default: null },

    status: {
      type: String,
      enum: ['draft', 'active', 'paused'],
      default: 'draft',
      index: true,
    },

    // Lightweight embedded analytics — detailed tracking in Module 7
    analytics: {
      totalScans: { type: Number, default: 0 },
      uniqueScans: { type: Number, default: 0 },
      lastScannedAt: { type: Date, default: null },
    },

    // Thumbnail for dashboard preview
    thumbnailUrl: { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

/* ── Indexes for common dashboard queries ──────────────────────── */
campaignSchema.index({ userId: 1, createdAt: -1 });
campaignSchema.index({ userId: 1, status: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);
module.exports = Campaign;
