'use strict';

const fs = require('fs');
const path = require('path');
const { LRUCache } = require('lru-cache');
const logger = require('../config/logger');

const GEO_ENDPOINT = process.env.GEOIP_ENDPOINT || 'https://ipwho.is/';
const GEO_ENABLED = process.env.GEOIP_ENABLED !== 'false';
const GEO_TIMEOUT_MS = Number(process.env.GEOIP_TIMEOUT_MS || 1500);
const GEO_DEBUG = process.env.GEO_DEBUG === 'true';

const maxmind = require('maxmind');

const cache = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 60 * 6, // 6h
});

/** Singleton MMDB reader — GeoLite2-City.mmdb */
let mmdbReader = null;
let mmdbLoadPromise = null;

const normalizeIp = (ip) => {
  if (!ip) return null;
  const s = String(ip).trim();
  if (!s) return null;
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s;
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

const isoCountryCodeToName = (code) => {
  if (!code || typeof code !== 'string') return null;
  const iso = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return null;
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(iso);
  } catch {
    return iso;
  }
};

/**
 * Normalize HTTP geo provider JSON (flat ipwhois.io, nested ipwho.org/ipwho.is `data`, etc.)
 * Exported for smoke tests.
 */
const extractGeoFieldsFromProviderJson = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.success === false) return null;

  let src = payload;
  if (payload.data && typeof payload.data === 'object') {
    if (payload.data.geoLocation && typeof payload.data.geoLocation === 'object') {
      src = payload.data.geoLocation;
    } else {
      src = payload.data;
    }
  }

  const country = src.country != null && src.country !== '' ? String(src.country) : null;
  const region = src.region != null && src.region !== '' ? String(src.region) : null;
  const city = src.city != null && src.city !== '' ? String(src.city) : null;
  const latitude = typeof src.latitude === 'number' ? src.latitude : null;
  const longitude = typeof src.longitude === 'number' ? src.longitude : null;

  if (!country && !region && !city && latitude == null && longitude == null) return null;

  return { country, region, city, latitude, longitude };
};

const getHeaderInsensitive = (req, name) => {
  const lower = name.toLowerCase();
  const key = Object.keys(req.headers || {}).find((k) => k.toLowerCase() === lower);
  return key ? req.headers[key] : undefined;
};

/**
 * Client IP for geo + rate limiting. Prefer Cloudflare headers on Render.
 */
const getClientIpFromRequest = (req) => {
  const cfConnecting = normalizeIp(getHeaderInsensitive(req, 'cf-connecting-ip'));
  if (cfConnecting && !isLocalOrPrivate(cfConnecting)) return cfConnecting;

  const trueClient = normalizeIp(getHeaderInsensitive(req, 'true-client-ip'));
  if (trueClient && !isLocalOrPrivate(trueClient)) return trueClient;

  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    const chain = forwarded
      .split(',')
      .map((v) => normalizeIp(v.trim()))
      .filter(Boolean);

    const firstPublic = chain.find((ip) => !isLocalOrPrivate(ip));
    if (firstPublic) return firstPublic;
    if (chain[0]) return chain[0];
  }

  return normalizeIp(req.ip);
};

const getCfIpCountry = (req) => {
  const raw = getHeaderInsensitive(req, 'cf-ipcountry');
  if (!raw || typeof raw !== 'string') return null;
  const c = raw.trim().toUpperCase();
  if (!c || c === 'XX' || c === 'T1') return null;
  return /^[A-Z]{2}$/.test(c) ? c : null;
};

const ensureMmdbReader = async () => {
  const dbPath = process.env.MAXMIND_DB_PATH || process.env.GEOIP_MMDB_PATH;
  if (!dbPath) return null;

  const resolved = path.isAbsolute(dbPath) ? dbPath : path.join(process.cwd(), dbPath);
  if (!fs.existsSync(resolved)) {
    if (GEO_DEBUG) logger.warn('geoLookup: MMDB file missing', { resolved });
    return null;
  }

  if (mmdbReader) return mmdbReader;
  if (!mmdbLoadPromise) {
    mmdbLoadPromise = maxmind.open(resolved).then((reader) => {
      mmdbReader = reader;
      logger.info('geoLookup: MaxMind MMDB loaded', { path: resolved });
      return reader;
    }).catch((err) => {
      logger.warn('geoLookup: MaxMind MMDB failed to open', { error: err.message });
      mmdbReader = null;
      mmdbLoadPromise = null;
      return null;
    });
  }
  return mmdbLoadPromise;
};

const lookupGeoFromMmdb = async (ip) => {
  const reader = await ensureMmdbReader();
  if (!reader) return null;

  let rec;
  try {
    rec = reader.get(ip);
  } catch {
    return null;
  }
  if (!rec) return null;

  const country =
    rec.country?.names?.en
    || rec.country?.iso_code
    || null;
  const region = rec.subdivisions?.[0]?.names?.en || rec.subdivisions?.[0]?.iso_code || null;
  const city = rec.city?.names?.en || null;
  const latitude = typeof rec.location?.latitude === 'number' ? rec.location.latitude : null;
  const longitude = typeof rec.location?.longitude === 'number' ? rec.location.longitude : null;

  if (!country && !city && !region && latitude == null && longitude == null) return null;

  return { country, region, city, latitude, longitude };
};

const lookupGeoFromHttp = async (ip) => {
  const base = GEO_ENDPOINT.endsWith('/') ? GEO_ENDPOINT : `${GEO_ENDPOINT}/`;
  const url = `${base}${encodeURIComponent(ip)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const payload = await res.json();
    const geo = extractGeoFieldsFromProviderJson(payload);
    return geo;
  } catch (err) {
    if (GEO_DEBUG) logger.debug('geoLookup HTTP failed', { ip: `${ip?.slice(0, 8)}…`, error: err.message });
    return null;
  }
};

const mergeCfCountry = (geo, cfCountryCode) => {
  const iso = cfCountryCode && String(cfCountryCode).trim().toUpperCase();
  if (!iso || !/^[A-Z]{2}$/.test(iso)) return geo;
  const name = isoCountryCodeToName(iso);
  if (!geo) return { country: name, region: null, city: null, latitude: null, longitude: null };
  if (!geo.country && name) return { ...geo, country: name };
  return geo;
};

/**
 * Resolve approximate geo for an IP. Optional hints:
 * @param {string|null} cfCountryCode — ISO-3166-1 alpha-2 from CF-IPCountry
 */
const lookupGeo = async (rawIp, hints = {}) => {
  if (!GEO_ENABLED) return null;

  const ip = normalizeIp(rawIp);
  const cfCountryCode = hints.cfCountryCode || hints.cfCountry || null;

  if (!ip || isLocalOrPrivate(ip)) {
    if (cfCountryCode) return mergeCfCountry(null, cfCountryCode);
    return null;
  }

  const cacheKey = ip;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached === null
      ? mergeCfCountry(null, cfCountryCode)
      : mergeCfCountry({ ...cached }, cfCountryCode);
  }

  let geo = await lookupGeoFromMmdb(ip);
  if (!geo) geo = await lookupGeoFromHttp(ip);

  const hasSignal =
    geo
    && (geo.country || geo.region || geo.city || geo.latitude != null || geo.longitude != null);

  if (!hasSignal) {
    cache.set(cacheKey, null);
    if (GEO_DEBUG) logger.debug('geoLookup: unresolved', { ipPrefix: ip.slice(0, 12) });
    return mergeCfCountry(null, cfCountryCode);
  }

  cache.set(cacheKey, geo);
  return mergeCfCountry({ ...geo }, cfCountryCode);
};

module.exports = {
  lookupGeo,
  getClientIpFromRequest,
  getCfIpCountry,
  extractGeoFieldsFromProviderJson,
};
