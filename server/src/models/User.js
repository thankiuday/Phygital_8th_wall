'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never return password in queries by default
    },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },

    avatar: {
      type: String,
      default: null,
      maxlength: [500, 'Avatar URL is too long'],
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    // Password reset flow
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // Soft-delete / suspension
    isActive: {
      type: Boolean,
      default: true,
    },

    // Track last login
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      // Strip sensitive fields when serialising to JSON
      transform(_doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/* ─────────────────────────────────────────
   Pre-save hook — hash password before save
   ───────────────────────────────────────── */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ─────────────────────────────────────────
   Instance method — compare plain password
   ───────────────────────────────────────── */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/* ─────────────────────────────────────────
   Instance method — generate password reset token
   Returns the raw token (to be emailed) and stores the hash
   ───────────────────────────────────────── */
userSchema.methods.generatePasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');
  // Store hashed version — never store raw tokens in DB
  this.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  this.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  return rawToken;
};

/* ─────────────────────────────────────────
   Static method — find by reset token
   ───────────────────────────────────────── */
userSchema.statics.findByResetToken = function (rawToken) {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');
  return this.findOne({
    passwordResetToken: hashed,
    passwordResetExpires: { $gt: Date.now() },
  }).select('+passwordResetToken +passwordResetExpires +password');
};

const User = mongoose.model('User', userSchema);
module.exports = User;
