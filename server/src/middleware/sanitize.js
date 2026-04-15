'use strict';

/**
 * sanitize.js — combined input sanitization middleware
 *
 * Applies two layers of protection on every request body, query, and params:
 *
 * 1. express-mongo-sanitize
 *    Strips keys that start with `$` or contain `.` from req.body, req.query,
 *    and req.params, preventing NoSQL injection attacks like:
 *      { "email": { "$gt": "" } }
 *
 * 2. xss (xss-filters)
 *    HTML-encodes every string value in the request body, preventing stored
 *    XSS payloads from being saved to the database and later rendered.
 *
 * Note: This runs AFTER body parsing but BEFORE route handlers.
 */

const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss');

// ── MongoDB injection sanitization ─────────────────────────────────────────
const mongoSanitizeMiddleware = mongoSanitize({
  replaceWith: '_', // replace forbidden chars with underscore rather than remove
  onSanitize: ({ req, key }) => {
    // In production, silently drop. In dev, warn.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[sanitize] Stripped MongoDB operator from key: ${key} — IP: ${req.ip}`);
    }
  },
});

// ── XSS sanitization (recursive object/array walker) ───────────────────────
const sanitizeValue = (value) => {
  if (typeof value === 'string') return xss(value);
  if (Array.isArray(value))     return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
};

const xssSanitizeMiddleware = (req, _res, next) => {
  if (req.body)   req.body   = sanitizeValue(req.body);
  if (req.query)  req.query  = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};

// ── Export as array so both middleware run in order ─────────────────────────
module.exports = [mongoSanitizeMiddleware, xssSanitizeMiddleware];
