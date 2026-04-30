'use strict';

/**
 * redirectCache.js — pluggable hot-path cache for /r/:slug → campaign.
 *
 * Backends
 *   • Default (zero-infra)  : in-process LRU (lru-cache).  Fast, free, zero ops.
 *                             Works for single-instance deploys (Render starter,
 *                             a single Fly machine, dev/staging).  Loses state
 *                             on restart and does NOT share across instances.
 *
 *   • Redis (production)    : auto-enabled when REDIS_URL is present.  Lazy-
 *                             requires `ioredis` (declared as an optional
 *                             dependency) so dev installs don't pay for it.
 *                             Cluster-safe; survives restarts; cross-instance.
 *
 * Public API (always Promise-based for backend-agnostic call sites)
 *   await redirectCache.get(slug)        → { _id, destinationUrl } | null
 *   await redirectCache.set(slug, value) → void
 *   await redirectCache.evict(slug)      → void
 *   redirectCache.backend                 → 'lru' | 'redis'
 *
 * Failure handling
 *   - get() never throws — Redis errors return null so the caller falls back
 *     to Mongo and the redirect path stays alive even when Redis is down.
 *   - set()/evict() errors are logged and swallowed; cache misses are cheap.
 */

const logger = require('../config/logger');

const TTL_MS = 60_000; // 60 s — short enough that paused/edited campaigns
                       // propagate quickly without hammering Mongo on every scan.
const MAX_ENTRIES = 1000;
const REDIS_KEY = (slug) => `qr:slug:${slug}`;

/* ─────────────────────────────────────────────────────────────────────────────
   LRU backend (default)
   ─────────────────────────────────────────────────────────────────────────── */

const buildLru = () => {
  // Lazy require so the worker process (which doesn't need the cache) doesn't
  // pay for it at boot.
  const { LRUCache } = require('lru-cache');

  const lru = new LRUCache({
    max: MAX_ENTRIES,
    ttl: TTL_MS,
    updateAgeOnGet: false, // hot keys still expire — destinations change!
    allowStale: false,
  });

  return {
    backend: 'lru',
    async get(slug) {
      return lru.get(slug) || null;
    },
    async set(slug, value) {
      lru.set(slug, value);
    },
    async evict(slug) {
      lru.delete(slug);
    },
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   Redis backend (lazy / optional)
   ─────────────────────────────────────────────────────────────────────────── */

const buildRedis = (redisUrl) => {
  let Redis;
  try {
    Redis = require('ioredis');
  } catch (err) {
    logger.warn('redirectCache: REDIS_URL set but ioredis is not installed — falling back to LRU', {
      error: err.message,
    });
    return buildLru();
  }

  const client = new Redis(redisUrl, {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });

  client.on('error', (err) => {
    logger.error('redirectCache redis error', { error: err.message });
  });

  client.on('connect', () => logger.info('redirectCache: connected to Redis'));

  return {
    backend: 'redis',
    async get(slug) {
      try {
        const raw = await client.get(REDIS_KEY(slug));
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        logger.warn('redirectCache.get failed — falling back to DB', { slug, error: err.message });
        return null;
      }
    },
    async set(slug, value) {
      try {
        await client.set(REDIS_KEY(slug), JSON.stringify(value), 'PX', TTL_MS);
      } catch (err) {
        logger.warn('redirectCache.set failed', { slug, error: err.message });
      }
    },
    async evict(slug) {
      try {
        await client.del(REDIS_KEY(slug));
      } catch (err) {
        logger.warn('redirectCache.evict failed', { slug, error: err.message });
      }
    },
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   Module-level singleton
   ─────────────────────────────────────────────────────────────────────────── */

const cache = process.env.REDIS_URL
  ? buildRedis(process.env.REDIS_URL)
  : buildLru();

logger.info(`redirectCache: backend=${cache.backend}`);

module.exports = cache;
