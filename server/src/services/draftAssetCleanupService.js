'use strict';

const logger = require('../config/logger');
const { cleanupDraftAssetsByAge } = require('./cloudinaryService');

let cleanupTimer = null;

const startDraftAssetCleanupScheduler = () => {
  if (cleanupTimer) return cleanupTimer;

  const intervalMs = Math.max(
    5 * 60 * 1000,
    Number(process.env.DRAFT_ASSET_CLEANUP_INTERVAL_MS) || 60 * 60 * 1000
  );
  const maxAgeHours = Math.max(1, Number(process.env.DRAFT_ASSET_MAX_AGE_HOURS) || 24);
  const maxPerRun = Math.max(10, Number(process.env.DRAFT_ASSET_CLEANUP_BATCH) || 100);

  const runCleanup = async () => {
    try {
      const result = await cleanupDraftAssetsByAge({ maxAgeHours, maxPerRun });
      if (result.deletedCount > 0) {
        logger.info('Draft asset cleanup completed', result);
      }
    } catch (err) {
      logger.warn('Draft asset cleanup failed', { error: err?.message || String(err) });
    }
  };

  // Run once shortly after boot, then periodically.
  setTimeout(runCleanup, 20 * 1000).unref();
  cleanupTimer = setInterval(runCleanup, intervalMs);
  cleanupTimer.unref();
  return cleanupTimer;
};

module.exports = { startDraftAssetCleanupScheduler };
