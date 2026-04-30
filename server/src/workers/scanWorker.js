'use strict';

/**
 * scanWorker.js — BullMQ worker for the scan-events queue.
 *
 * Run as a separate process: `npm run worker`.
 *
 * Activates only when REDIS_URL is set; otherwise the API server uses the
 * direct-insert backend in scanQueue.js and this worker isn't needed.
 *
 * Production deployment
 *   - Deploy as a separate Render Worker / Fly machine sharing the same env.
 *   - The worker only needs MONGO_URI + REDIS_URL + IP_SALT — it does not
 *     listen on any port.
 *   - Monitor jobs via BullMQ Dashboard or Bull-board (out of scope here).
 */

require('dotenv').config();
require('express-async-errors');

const logger = require('../config/logger');

if (!process.env.REDIS_URL) {
  logger.error('scanWorker requires REDIS_URL — aborting');
  process.exit(1);
}

const connectDB = require('../config/db');
const { normalizeAndPersist } = require('../utils/scanQueue');

let Worker;
try {
  ({ Worker } = require('bullmq'));
} catch (err) {
  logger.error('scanWorker: bullmq is not installed — `npm install bullmq ioredis` first', {
    error: err.message,
  });
  process.exit(1);
}

const main = async () => {
  await connectDB();

  const url = new URL(process.env.REDIS_URL);
  const connection = {
    host: url.hostname,
    port: Number(url.port) || 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };

  const worker = new Worker(
    'scan-events',
    async (job) => {
      await normalizeAndPersist(job.data);
    },
    {
      connection,
      concurrency: Number(process.env.SCAN_WORKER_CONCURRENCY) || 8,
      // Throttle so a sudden scan burst doesn't overwhelm Mongo.
      limiter: { max: 50, duration: 1000 },
    }
  );

  worker.on('completed', (job) => {
    logger.debug('scan job ok', { id: job.id });
  });

  worker.on('failed', (job, err) => {
    logger.warn('scan job failed', { id: job?.id, attempts: job?.attemptsMade, error: err.message });
  });

  logger.info('scanWorker started', { queue: 'scan-events' });

  const shutdown = async (signal) => {
    logger.info(`scanWorker: received ${signal}, draining…`);
    try {
      await worker.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch((err) => {
  logger.error('scanWorker bootstrap failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
