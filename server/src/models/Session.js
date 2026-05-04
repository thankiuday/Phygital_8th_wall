'use strict';

const mongoose = require('mongoose');

/**
 * One row per signed-in device/browser tab chain.
 * Refresh token JWT is verified first; this hash must match for rotation.
 */
const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, refreshTokenHash: 1 }, { unique: true });

module.exports = mongoose.model('Session', sessionSchema);
