'use strict';

const crypto = require('crypto');

/** Lowercase URL handle: 3–30 chars, start/end alphanumeric, hyphens inside. */
const USER_HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

const RESERVED = new Set([
  'open', 'l', 'r', 'api', 'card', 'print', 'ar', 'dashboard', 'admin',
  'login', 'register', 'auth', 'about', 'contact', 'pricing', 'create',
  'user', 'users', 'me', 'public', 'static', 'assets', 'www', 'ftp',
]);

const normalizeBase = (email) => {
  const local = String(email || '').split('@')[0] || '';
  let s = local.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s.length || s.length < 3) s = 'user';
  if (RESERVED.has(s)) s = `${s}-hub`;
  return s.slice(0, 24);
};

/**
 * Allocate a globally unique handle for `email` (typically at signup).
 * @param {import('mongoose').Model} UserModel
 * @param {string} email
 */
const allocateUniqueHandleFromEmail = async (UserModel, email) => {
  const base = normalizeBase(email);
  for (let i = 0; i < 200; i += 1) {
    const candidate = (i === 0 ? base : `${base}-${i + 1}`).slice(0, 30);
    if (!USER_HANDLE_RE.test(candidate)) continue;
    const exists = await UserModel.exists({ handle: candidate });
    if (!exists) return candidate;
  }
  for (let j = 0; j < 30; j += 1) {
    const suffix = crypto.randomBytes(3).toString('hex');
    const candidate = `${base.slice(0, 18)}-${suffix}`.slice(0, 30);
    if (!USER_HANDLE_RE.test(candidate)) continue;
    if (!await UserModel.exists({ handle: candidate })) return candidate;
  }
  throw new Error('Could not allocate user handle');
};

module.exports = {
  USER_HANDLE_RE,
  allocateUniqueHandleFromEmail,
};
