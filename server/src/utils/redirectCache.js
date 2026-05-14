'use strict';

/**
 * Slug-keyed caches for dynamic QR hot paths.
 *
 * - redirectCache     — GET /r/:slug resolution (lean campaign fields)
 * - dynamicQrMetaCache — GET /api/public/dynamic-qr/:slug/meta payloads
 *
 * Backends: in-process LRU (default) or Redis when REDIS_URL + ioredis.
 * Both caches share one Redis connection when Redis is enabled.
 */

const logger = require('../config/logger');

const TTL_MS = 60_000;
const MAX_ENTRIES = 1000;

let sharedRedisClient = null;

const getRedisClient = () => {
  if (sharedRedisClient !== null && sharedRedisClient !== false) {
    return sharedRedisClient;
  }
  if (!process.env.REDIS_URL) {
    sharedRedisClient = false;
    return null;
  }
  let Redis;
  try {
    Redis = require('ioredis');
  } catch (err) {
    logger.warn('slugCache: REDIS_URL set but ioredis is not installed — using LRU', {
      error: err.message,
    });
    sharedRedisClient = false;
    return null;
  }
  sharedRedisClient = new Redis(process.env.REDIS_URL, {
    enableAutoPipelining: true,
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });
  sharedRedisClient.on('error', (err) => {
    logger.error('slugCache redis error', { error: err.message });
  });
  sharedRedisClient.on('connect', () => logger.info('slugCache: connected to Redis'));
  return sharedRedisClient;
};

const createLruSlugCache = () => {
  const { LRUCache } = require('lru-cache');
  const lru = new LRUCache({
    max: MAX_ENTRIES,
    ttl: TTL_MS,
    updateAgeOnGet: false,
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

const createRedisSlugCache = (keyPrefix) => {
  const client = getRedisClient();
  if (!client) return null;
  const redisKey = (slug) => `${keyPrefix}${slug}`;
  return {
    backend: 'redis',
    async get(slug) {
      try {
        const raw = await client.get(redisKey(slug));
        return raw ? JSON.parse(raw) : null;
      } catch (err) {
        logger.warn('slugCache.get failed — falling back to DB', { slug, error: err.message });
        return null;
      }
    },
    async set(slug, value) {
      try {
        await client.set(redisKey(slug), JSON.stringify(value), 'PX', TTL_MS);
      } catch (err) {
        logger.warn('slugCache.set failed', { slug, error: err.message });
      }
    },
    async evict(slug) {
      try {
        await client.del(redisKey(slug));
      } catch (err) {
        logger.warn('slugCache.evict failed', { slug, error: err.message });
      }
    },
  };
};

const createSlugCache = (keyPrefix) => {
  if (process.env.REDIS_URL) {
    const redis = createRedisSlugCache(keyPrefix);
    if (redis) return redis;
  }
  return createLruSlugCache();
};

const redirectCache = createSlugCache('qr:slug:');
const dynamicQrMetaCache = createSlugCache('qr:meta:');
/**
 * Public meta cache for digital-business-card hubs at /card/:slug. Cards are
 * read-heavy (one user shares the link, many strangers scan) so we want to
 * keep Mongo cold on the hot path. Eviction happens in the controller on
 * updateCampaign / deleteCampaign / cardSlug rename.
 */
const cardMetaCache = createSlugCache('qr:card:meta:v4:');

logger.info(`redirectCache: backend=${redirectCache.backend}`);
logger.info(`dynamicQrMetaCache: backend=${dynamicQrMetaCache.backend}`);
logger.info(`cardMetaCache: backend=${cardMetaCache.backend}`);

module.exports = { redirectCache, dynamicQrMetaCache, cardMetaCache };
