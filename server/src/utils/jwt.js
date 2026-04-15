'use strict';

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/* ─────────────────────────────────────────
   Token generators
   ───────────────────────────────────────── */

/**
 * Creates a short-lived JWT access token (default 15 minutes).
 * Stored in memory on the client — never in localStorage.
 */
const signAccessToken = (userId, role) => {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
  });
};

/**
 * Creates a long-lived JWT refresh token (default 7 days).
 * Sent as an httpOnly, Secure, SameSite=Strict cookie.
 */
const signRefreshToken = (userId) => {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  });
};

/* ─────────────────────────────────────────
   Token verifiers
   ───────────────────────────────────────── */

const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/* ─────────────────────────────────────────
   Cookie helpers
   ───────────────────────────────────────── */

/**
 * Sets the refresh token as an httpOnly cookie on the response.
 */
const setRefreshCookie = (res, token) => {
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('p8w_refresh', token, {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge,
    path: '/api/auth',
  });
};

/**
 * Clears the refresh token cookie.
 */
const clearRefreshCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('p8w_refresh', {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/auth',
  });
};

/**
 * Hash a refresh token for safe DB storage.
 * We never store raw refresh tokens.
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  hashToken,
};
