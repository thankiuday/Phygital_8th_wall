'use strict';

const User = require('../models/User');

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true';
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

/**
 * Ensures an admin account exists when ADMIN_EMAIL + ADMIN_PASSWORD are set.
 *
 * Env flags:
 * - ADMIN_EMAIL
 * - ADMIN_PASSWORD
 * - ADMIN_NAME (optional, defaults to "Platform Admin")
 * - ADMIN_BOOTSTRAP_SYNC_PASSWORD (optional, default true)
 */
const ensureAdminBootstrapUser = async () => {
  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  const adminName = String(process.env.ADMIN_NAME || 'Platform Admin').trim().slice(0, 60) || 'Platform Admin';
  const syncPassword = toBool(process.env.ADMIN_BOOTSTRAP_SYNC_PASSWORD, true);

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existing = await User.findOne({ email: adminEmail }).select('+password');

  if (!existing) {
    await User.create({
      name: adminName,
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      isActive: true,
      isEmailVerified: true,
      authProvider: 'local',
    });
    console.info(`✓ Admin bootstrap user created: ${adminEmail}`);
    return;
  }

  let changed = false;
  if (existing.role !== 'admin') {
    existing.role = 'admin';
    changed = true;
  }
  if (!existing.isActive) {
    existing.isActive = true;
    changed = true;
  }
  if (!existing.isEmailVerified) {
    existing.isEmailVerified = true;
    changed = true;
  }

  if (syncPassword) {
    const matches = await existing.comparePassword(adminPassword);
    if (!matches) {
      existing.password = adminPassword;
      changed = true;
    }
  }

  if (changed) {
    await existing.save();
    console.info(`✓ Admin bootstrap user updated: ${adminEmail}`);
  }
};

module.exports = { ensureAdminBootstrapUser };

