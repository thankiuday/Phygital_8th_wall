'use strict';

/**
 * cardRenderWorker.js — standalone process that consumes the BullMQ
 * `card-render` queue and writes rendered PNGs to Cloudinary.
 *
 * Run with: `node server/src/workers/cardRenderWorker.js`
 *
 * Co-located with `scanWorker.js` so the deployment story stays consistent
 * (Render: a second worker service of the same image; PM2: a second
 * `pm2 start` entry). Splitting Puppeteer onto its own machine is the
 * recommended next step at scale and is a deploy-config flip, not a code
 * change — this file is the only entrypoint that needs to run.
 */

require('dotenv').config();
const logger = require('../config/logger');
const { CARD_RENDER_QUEUE_NAME, renderCardJob } = require('../services/cardPrintService');

const start = async () => {
  if (!process.env.REDIS_URL) {
    logger.error('cardRenderWorker: REDIS_URL is required');
    process.exit(1);
  }
  let Worker;
  try {
    ({ Worker } = require('bullmq'));
  } catch (err) {
    logger.error('cardRenderWorker: bullmq is not installed', { error: err.message });
    process.exit(1);
  }

  let connection;
  try {
    const url = new URL(process.env.REDIS_URL);
    connection = {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    logger.error('cardRenderWorker: invalid REDIS_URL');
    process.exit(1);
  }

  const concurrency = Math.max(1, Number(process.env.RENDER_WORKER_CONCURRENCY) || 2);

  const worker = new Worker(
    CARD_RENDER_QUEUE_NAME,
    async (job) => {
      const { campaignId, userId, cardSlug, size, face, renderHash } = job.data;
      logger.info('cardRenderWorker: rendering', { campaignId, size, face, renderHash });
      const result = await renderCardJob({ campaignId, userId, cardSlug, size, face, renderHash });
      return {
        url: result.url,
        public_id: result.public_id,
        face: face || 'front',
      };
    },
    { connection, concurrency }
  );

  worker.on('failed', (job, err) => {
    logger.warn('cardRenderWorker: job failed', {
      jobId: job?.id,
      error: err?.message,
    });
  });
  worker.on('error', (err) => {
    logger.warn('cardRenderWorker: worker error', { error: err?.message });
  });

  logger.info(`cardRenderWorker: started (concurrency=${concurrency})`);
};

start().catch((err) => {
  logger.error('cardRenderWorker: failed to start', { error: err.message });
  process.exit(1);
});
