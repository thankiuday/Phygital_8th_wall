'use strict';

const mongoose = require('mongoose');

const linkItemSchema = {
  linkId: { type: String, required: true },
  kind: { type: String, required: true },
  label: { type: String, required: true, maxlength: 80 },
  value: { type: String, required: true, maxlength: 500 },
  logoUrl: { type: String, default: null },
  logoPublicId: { type: String, default: null },
};

const arCardServiceRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['submitted', 'in_progress', 'completed', 'cancelled'],
      default: 'submitted',
      index: true,
    },

    /** Distinguishes AR Card vs AR Poster service requests (same workflow). */
    requestKind: {
      type: String,
      enum: ['ar-card', 'ar-poster'],
      default: 'ar-card',
      required: true,
      index: true,
    },

    targetImageUrl: { type: String, required: true },
    targetImagePublicId: { type: String, default: null },

    qrPlacement: { type: mongoose.Schema.Types.Mixed, default: null },

    greenscreenVideoUrl: { type: String, required: true },
    greenscreenVideoPublicId: { type: String, default: null },

    linkItems: {
      type: [linkItemSchema],
      default: undefined,
    },

    userNotes: { type: String, default: null, maxlength: 500 },

    adminNotes: { type: String, default: null, maxlength: 1000 },

    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      default: null,
    },

    fulfilledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    submittedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

arCardServiceRequestSchema.index({ userId: 1, requestKind: 1, status: 1, createdAt: -1 });
arCardServiceRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });
arCardServiceRequestSchema.index({ status: 1, requestKind: 1, createdAt: -1 });

module.exports = mongoose.model('ArCardServiceRequest', arCardServiceRequestSchema);
