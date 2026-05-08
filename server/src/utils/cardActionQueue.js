'use strict';

/**
 * cardActionQueue.js — fire-and-forget telemetry for digital-business-card
 * action beacons (call/email/whatsapp/social/cta etc.).
 *
 * A single hot card can fan out to ~20 events per session (call tap, social
 * tap, gallery views, video plays, doc opens, …). Writing those one at a
 * time keeps the public route responsive but creates DB pressure.
 *
 * Pattern mirrors `scanQueue.js`:
 *   • Default (zero-infra)   : direct LinkClickEvent.create + $inc.
 *   • BullMQ (production)    : when `REDIS_URL` is set, enqueue and let a
 *     batch worker drain the queue with `bulkWrite`. (Worker can be added
 *     later — for now BullMQ uses a Worker-less consumer pattern from
 *     `cardRenderWorker.js` style; keeping the abstraction here so the
 *     route never has to know.)
 */

const logger = require('../config/logger');
const LinkClickEvent = require('../models/LinkClickEvent');
const Campaign = require('../models/Campaign');

const ALLOWED_ACTIONS = new Set([
  'call', 'email', 'whatsapp', 'website', 'social',
  'galleryView', 'videoPlay', 'docOpen', 'cta', 'print-download',
]);

const sanitizeTarget = (target) => {
  if (typeof target !== 'string') return null;
  const trimmed = target.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
};

const persistDirectly = async ({ campaignId, userId, action, target, visitorHash }) => {
  if (!ALLOWED_ACTIONS.has(action)) return;
  const safeTarget = sanitizeTarget(target);
  // We store the action+target as `linkId` so the existing analytics surface
  // (which keys by linkId) can render breakdowns without a schema migration.
  const linkId = safeTarget ? `${action}:${safeTarget}` : action;
  await Promise.all([
    LinkClickEvent.create({
      campaignId,
      userId,
      linkId,
      kind: 'link',
      visitorHash: visitorHash || null,
      clickedAt: new Date(),
    }),
    Campaign.updateOne(
      { _id: campaignId },
      { $inc: { [`analytics.cardActionTotals.${action}`]: 1 } }
    ),
  ]);
};

const directBackend = {
  backend: 'direct',
  enqueue(event) {
    Promise.resolve()
      .then(() => persistDirectly(event))
      .catch((err) => logger.warn('cardActionQueue.direct persist failed', { error: err.message }));
  },
};

const buildBullmqAdapter = (redisUrl) => {
  let Queue;
  try {
    ({ Queue } = require('bullmq'));
  } catch (err) {
    logger.warn('cardActionQueue: REDIS_URL set but bullmq is not installed — using direct backend', {
      error: err.message,
    });
    return directBackend;
  }
  let connection;
  try {
    const url = new URL(redisUrl);
    connection = {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    logger.warn('cardActionQueue: invalid REDIS_URL — using direct backend');
    return directBackend;
  }

  const queue = new Queue('card-actions', { connection });
  logger.info('cardActionQueue: backend=bullmq');

  return {
    backend: 'bullmq',
    enqueue(event) {
      queue.add('action', event, {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      }).catch((err) => logger.warn('cardActionQueue.bullmq enqueue failed', { error: err.message }));
    },
  };
};

const adapter = process.env.REDIS_URL ? buildBullmqAdapter(process.env.REDIS_URL) : directBackend;
if (adapter.backend === 'direct') logger.info('cardActionQueue: backend=direct');

module.exports = {
  ...adapter,
  persistDirectly,
  ALLOWED_ACTIONS,
};
