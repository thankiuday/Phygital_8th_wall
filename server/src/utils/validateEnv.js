'use strict';

/**
 * validateEnv.js — crash-fast on missing required environment variables.
 *
 * Called once at server startup (before any routes are mounted).
 * If a required variable is missing, we log a clear error and exit with code 1
 * rather than silently running in a broken state.
 *
 * Groups variables so error messages tell you exactly which service is affected.
 */

const REQUIRED = {
  'Core': [
    'NODE_ENV',
    'PORT',
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

// These are only required in production
const PRODUCTION_ONLY = {
  'Email (SMTP)': [
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
  ],
  'Deployment': [
    'CLIENT_URL',
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

  if (process.env.NODE_ENV === 'production') {
    for (const [group, keys] of Object.entries(PRODUCTION_ONLY)) {
      for (const key of keys) {
        if (!process.env[key]) {
          missing.push(`  [${group}] ${key}`);
        }
      }
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:\n');
    missing.forEach((m) => console.error(m));
    console.error('\nCopy server/.env.example to server/.env and fill in all values.\n');
    process.exit(1);
  }
};

module.exports = validateEnv;
