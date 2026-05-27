'use strict';

const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 32,
      index: true,
    },
    description: { type: String, default: '', maxlength: 200 },

    benefit: {
      type: String,
      enum: ['full_access', 'extra_campaigns', 'extended_storage'],
      default: 'full_access',
    },

    maxUses: { type: Number, default: 1, min: 1, max: 10000 },
    usedCount: { type: Number, default: 0 },
    expiresAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true, index: true },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    redemptions: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        redeemedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

couponSchema.virtual('isValid').get(function () {
  if (!this.isActive) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  if (this.usedCount >= this.maxUses) return false;
  return true;
});

module.exports = mongoose.model('Coupon', couponSchema);
