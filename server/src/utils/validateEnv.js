'use strict';

/**
 * validateEnv.js — crash-fast on missing required environment variables.
 *
 * Only the absolute minimum set needed to boot the server is required.
 * Optional services (SMTP, etc.) are warned but not fatal — the server
 * starts in a degraded mode instead of refusing to start at all.
 */

const REQUIRED = {
  'Core': [
    'NODE_ENV',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
  ],
  'MongoDB': [
    'MONGO_URI',
  ],
  'Cloudinary': [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ],
};

// Warn about these but do NOT crash — server works without them
const OPTIONAL = {
  'Email (SMTP) — password reset emails will not work': [
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
  ],
};

const validateEnv = () => {
  const missing = [];

  for (const [group, keys] of Object.entries(REQUIRED)) {
    for (const key of keys) {
      if (!process.env[key]) {
        missing.push(`  [${group}] ${key}`);
      }
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:\n');
    missing.forEach((m) => console.error(m));
    console.error('\nSet these in your Render environment variables dashboard.\n');
    process.exit(1);
  }

  // Google OAuth — only validate when Google credentials (or explicit redirect) are set.
  // Callback URL can be explicit `GOOGLE_REDIRECT_URI` or derived from `RENDER_EXTERNAL_URL` / `API_PUBLIC_URL`.
  const gId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const gSec = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const gRedirExplicit = (process.env.GOOGLE_REDIRECT_URI || '').trim();
  const clientUrl = (process.env.CLIENT_URL || '').trim();
  const renderExt = (process.env.RENDER_EXTERNAL_URL || '').trim();
  const apiPublic = (process.env.API_PUBLIC_URL || '').trim();

  const hasAnyGoogleOAuthVar = !!(gId || gSec || gRedirExplicit);
  if (hasAnyGoogleOAuthVar) {
    const missingGoogle = [];
    if (!gId) missingGoogle.push('GOOGLE_CLIENT_ID');
    if (!gSec) missingGoogle.push('GOOGLE_CLIENT_SECRET');
    if (!clientUrl) missingGoogle.push('CLIENT_URL');
    const hasRedirectSource = !!(gRedirExplicit || renderExt || apiPublic);
    if (!hasRedirectSource) {
      missingGoogle.push(
        'GOOGLE_REDIRECT_URI (or RENDER_EXTERNAL_URL / API_PUBLIC_URL for automatic callback URL)'
      );
    }
    if (missingGoogle.length > 0) {
      console.error('\n❌ Incomplete Google OAuth environment variables:\n');
      missingGoogle.forEach((k) => console.error(`  [Google OAuth] ${k}`));
      console.error(
        '\nSet the listed variables, or remove Google OAuth vars to disable Google sign-in.\n'
      );
      process.exit(1);
    }
  }

  // Warn about optional but missing vars (no crash)
  const warnings = [];
  for (const [group, keys] of Object.entries(OPTIONAL)) {
    for (const key of keys) {
      if (!process.env[key]) warnings.push(`  [${group}] ${key}`);
    }
  }
  if (warnings.length > 0) {
    console.warn('\n⚠️  Optional env vars not set (non-fatal):\n');
    warnings.forEach((w) => console.warn(w));
    console.warn('');
  }
};

module.exports = validateEnv;
