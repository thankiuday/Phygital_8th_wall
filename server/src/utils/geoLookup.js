'use strict';

const { LRUCache } = require('lru-cache');
const logger = require('../config/logger');

const GEO_ENDPOINT = process.env.GEOIP_ENDPOINT || 'https://ipwho.is/';
const GEO_ENABLED = process.env.GEOIP_ENABLED !== 'false';
const GEO_TIMEOUT_MS = Number(process.env.GEOIP_TIMEOUT_MS || 1500);

const cache = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 60 * 6, // 6h
});

const normalizeIp = (ip) => {
  if (!ip) return null;
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
};

const isLocalOrPrivate = (ip) => {
  if (!ip) return true;
  if (ip.includes(':')) return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd');
  const octets = ip.split('.').map((n) => Number(n));
  const [a, b] = octets;
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  return (
    ip === '127.0.0.1'
    || a === 10
    || (a === 192 && b === 168)
    || (a === 172 && b >= 16 && b <= 31)
  );
};

const lookupGeo = async (rawIp) => {
  if (!GEO_ENABLED) return null;
  const ip = normalizeIp(rawIp);
  if (!ip || isLocalOrPrivate(ip)) return null;

  const cached = cache.get(ip);
  if (cached !== undefined) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(`${GEO_ENDPOINT}${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      cache.set(ip, null);
      return null;
    }

    const data = await res.json();
    if (data?.success === false) {
      cache.set(ip, null);
      return null;
    }

    const geo = {
      country: data?.country || null,
      region: data?.region || null,
      city: data?.city || null,
      latitude: typeof data?.latitude === 'number' ? data.latitude : null,
      longitude: typeof data?.longitude === 'number' ? data.longitude : null,
    };
    cache.set(ip, geo);
    return geo;
  } catch (err) {
    logger.debug('geoLookup failed', { error: err.message });
    cache.set(ip, null);
    return null;
  }
};

module.exports = { lookupGeo };
