'use strict';

const mongoose = require('mongoose');

const linkClickEventSchema = new mongoose.Schema(
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
    linkId: {
      type: String,
      required: true,
    },
    visitorHash: { type: String, default: null, index: true },
    country: { type: String, default: null },
    city: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    clickedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

linkClickEventSchema.index({ campaignId: 1, clickedAt: -1 });
linkClickEventSchema.index({ campaignId: 1, linkId: 1, clickedAt: -1 });

module.exports = mongoose.model('LinkClickEvent', linkClickEventSchema);
