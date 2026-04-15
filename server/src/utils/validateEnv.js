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
