'use strict';

const fs = require('fs');
const path = require('path');
const { LRUCache } = require('lru-cache');
const logger = require('../config/logger');

const GEO_ENDPOINT = process.env.GEOIP_ENDPOINT || 'https://ipwho.is/';
const GEO_ENABLED = process.env.GEOIP_ENABLED !== 'false';
const GEO_TIMEOUT_MS = Number(process.env.GEOIP_TIMEOUT_MS || 2800);
const GEO_REVERSE_GEOCODE = process.env.GEO_REVERSE_GEOCODE !== 'false';
const GEO_DEBUG = process.env.GEO_DEBUG === 'true';

const maxmind = require('maxmind');

const cache = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 60 * 6, // 6h
});

/** Lat/lng reverse-geocode cache (BigDataCloud + Nominatim fallback). */
const reverseCoordCache = new LRUCache({
  max: 3000,
  ttl: 1000 * 60 * 60 * 6,
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

const trimStr = (v) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const firstStringAcrossLayers = (layers, keys) => {
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const key of keys) {
      const t = trimStr(layer[key]);
      if (t) return t;
    }
  }
  return null;
};

const firstCoordAcrossLayers = (layers, keys) => {
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    for (const key of keys) {
      const raw = layer[key];
      if (raw == null || raw === '') continue;
      const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};

/** Prefer nested geo, then `data.*`, then root (covers ipwho.org + ipwho.is + ipwhois.io shapes). */
const buildProviderLayers = (payload) => {
  const layers = [];
  if (!payload || typeof payload !== 'object') return layers;
  const { data } = payload;
  if (data?.geoLocation && typeof data.geoLocation === 'object') layers.push(data.geoLocation);
  if (data && typeof data === 'object') layers.push(data);
  layers.push(payload);
  return layers;
};

/**
 * Normalize HTTP geo provider JSON (flat ipwhois.io, nested ipwho.org/ipwho.is `data`, etc.)
 * Exported for smoke tests.
 */
const extractGeoFieldsFromProviderJson = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.success === false) return null;

  const layers = buildProviderLayers(payload);

  let country = firstStringAcrossLayers(layers, ['country', 'country_name', 'countryName']);
  if (!country) {
    const code = firstStringAcrossLayers(layers, ['countryCode', 'country_code']);
    if (code && /^[A-Za-z]{2}$/.test(code)) {
      country = isoCountryCodeToName(code.toUpperCase()) || code.toUpperCase();
    }
  }

  let region = firstStringAcrossLayers(layers, [
    'region',
    'state',
    'province',
    'state_prov',
    'subdivision',
    'region_name',
    'regionName',
  ]);
  if (!region) {
    region = firstStringAcrossLayers(layers, ['regionCode', 'region_code']);
  }

  const city = firstStringAcrossLayers(layers, ['city', 'town', 'district']);

  const latitude = firstCoordAcrossLayers(layers, ['latitude', 'lat']);
  const longitude = firstCoordAcrossLayers(layers, ['longitude', 'lng', 'lon']);

  if (!country && !region && !city && latitude == null && longitude == null) return null;

  return { country, region, city, latitude, longitude };
};

const getHeaderInsensitive = (req, name) => {
  const lower = name.toLowerCase();
  const key = Object.keys(req.headers || {}).find((k) => k.toLowerCase() === lower);
  return key ? req.headers[key] : undefined;
};

/** First IP/client id from a header (handles array headers + comma lists). */
const headerFirstIpLike = (req, name) => {
  const raw = getHeaderInsensitive(req, name);
  if (raw == null) return null;
  const first = Array.isArray(raw) ? raw[0] : String(raw).split(',')[0];
  return normalizeIp(first);
};

/**
 * Client IP for geo + rate limiting. Prefer Cloudflare headers on Render.
 */
const getClientIpFromRequest = (req) => {
  const candidates = [
    headerFirstIpLike(req, 'cf-connecting-ip'),
    headerFirstIpLike(req, 'true-client-ip'),
    headerFirstIpLike(req, 'fly-client-ip'),
    headerFirstIpLike(req, 'x-real-ip'),
  ];

  for (const ip of candidates) {
    if (ip && !isLocalOrPrivate(ip)) return ip;
  }

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

  const expressIp = normalizeIp(req.ip);
  if (expressIp && !isLocalOrPrivate(expressIp)) return expressIp;

  const socketIp = normalizeIp(req.socket?.remoteAddress);
  if (socketIp && !isLocalOrPrivate(socketIp)) return socketIp;

  return null;
};

const getCfIpCountry = (req) => {
  let raw = getHeaderInsensitive(req, 'cf-ipcountry');
  if (Array.isArray(raw)) raw = raw[0];
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

const pickLocalizedName = (namesObj) => {
  if (!namesObj || typeof namesObj !== 'object') return null;
  return trimStr(namesObj.en) || trimStr(namesObj[Object.keys(namesObj)[0]]);
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
    pickLocalizedName(rec.country?.names)
    || trimStr(rec.country?.iso_code)
    || null;
  const region =
    pickLocalizedName(rec.subdivisions?.[0]?.names)
    || trimStr(rec.subdivisions?.[0]?.iso_code)
    || null;
  const city = pickLocalizedName(rec.city?.names);
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

const mergeGeoRecords = (a, b) => {
  if (!a) return b;
  if (!b) return a;
  return {
    country: trimStr(a.country) || trimStr(b.country) || null,
    region: trimStr(a.region) || trimStr(b.region) || null,
    city: trimStr(a.city) || trimStr(b.city) || null,
    latitude: a.latitude != null && Number.isFinite(a.latitude) ? a.latitude : b.latitude,
    longitude: a.longitude != null && Number.isFinite(a.longitude) ? a.longitude : b.longitude,
  };
};

/** GeoLite2 often returns country-only rows; fill city/region from HTTP when missing */
const needsHttpEnrichment = (g) => !g || !(trimStr(g.city) || trimStr(g.region));

/** MMDB/IP APIs sometimes only yield coordinates; derive labels from lat/lng */
const needsMetroReverse = (g) =>
  !!g
  && Number.isFinite(g.latitude)
  && Number.isFinite(g.longitude)
  && !(trimStr(g.city) || trimStr(g.region));

const reverseGeocodeFromCoords = async (latitude, longitude) => {
  if (!GEO_REVERSE_GEOCODE) return null;

  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client`
    + `?latitude=${encodeURIComponent(latitude)}`
    + `&longitude=${encodeURIComponent(longitude)}`
    + '&localityLanguage=en';

  try {
    const controller = new AbortController();
    const timeoutMs = Math.min(GEO_TIMEOUT_MS, 2800);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const city = trimStr(data.city || data.locality);
    const region = trimStr(data.principalSubdivision || data.principalSubdivisionCode);
    const country = trimStr(data.countryName);

    if (!city && !region && !country) return null;

    return {
      country: country || null,
      region: region || null,
      city: city || null,
      latitude,
      longitude,
    };
  } catch (err) {
    if (GEO_DEBUG) logger.debug('geoLookup reverse-geocode failed', { error: err.message });
    return null;
  }
};

/**
 * OpenStreetMap Nominatim — fallback when BigDataCloud returns nothing.
 * https://operations.osmfoundation.org/policies/nominatim/ — identify app in User-Agent.
 */
const reverseGeocodeNominatim = async (latitude, longitude) => {
  if (!GEO_REVERSE_GEOCODE) return null;

  const url =
    'https://nominatim.openstreetmap.org/reverse'
    + `?lat=${encodeURIComponent(latitude)}`
    + `&lon=${encodeURIComponent(longitude)}`
    + '&format=json'
    + '&addressdetails=1';

  try {
    const controller = new AbortController();
    const timeoutMs = Math.min(GEO_TIMEOUT_MS, 3200);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Phygital/1.0 (+https://github.com/thankiuday/Phygital_8th_wall)',
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const addr = data.address || {};
    const city = trimStr(
      addr.city
      || addr.town
      || addr.village
      || addr.municipality
      || addr.county
      || addr.hamlet
    );
    const region = trimStr(addr.state || addr.region || addr.province);
    const country = trimStr(addr.country);

    if (!city && !region && !country) return null;

    return {
      country: country || null,
      region: region || null,
      city: city || null,
      latitude,
      longitude,
    };
  } catch (err) {
    if (GEO_DEBUG) logger.debug('geoLookup nominatim reverse failed', { error: err.message });
    return null;
  }
};

/**
 * Cached reverse geocode (primary + Nominatim). Used for IP metro gaps and
 * browser/hybrid GPS so city/region match the final coordinates.
 */
const reverseGeocodeCoordsWithFallback = async (latitude, longitude) => {
  if (!GEO_REVERSE_GEOCODE) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = reverseCoordCache.get(key);
  if (cached !== undefined) return cached;

  let rev = await reverseGeocodeFromCoords(latitude, longitude);
  if (!rev) rev = await reverseGeocodeNominatim(latitude, longitude);
  if (rev) reverseCoordCache.set(key, rev);
  return rev;
};

/**
 * Fill missing city/region (and country if absent) from lat/lng after IP + browser merge.
 * @param {number} latitude
 * @param {number} longitude
 * @param {{ country?: string|null, region?: string|null, city?: string|null }} partial
 */
const enrichLocationLabelsFromCoords = async (latitude, longitude, partial = {}) => {
  const base = {
    country: partial.country ?? null,
    region: partial.region ?? null,
    city: partial.city ?? null,
    latitude,
    longitude,
  };
  if (!GEO_REVERSE_GEOCODE) return base;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return base;
  if (trimStr(base.city) && trimStr(base.region)) return base;

  const rev = await reverseGeocodeCoordsWithFallback(latitude, longitude);
  if (!rev) return base;
  return mergeGeoRecords(base, rev);
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

  const cacheKey = `g3:${ip}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached === null
      ? mergeCfCountry(null, cfCountryCode)
      : mergeCfCountry({ ...cached }, cfCountryCode);
  }

  let geo = await lookupGeoFromMmdb(ip);
  if (needsHttpEnrichment(geo)) {
    const httpGeo = await lookupGeoFromHttp(ip);
    geo = mergeGeoRecords(geo, httpGeo);
  }
  if (needsMetroReverse(geo)) {
    const rev = await reverseGeocodeCoordsWithFallback(geo.latitude, geo.longitude);
    geo = mergeGeoRecords(geo, rev);
  }

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
  enrichLocationLabelsFromCoords,
  getClientIpFromRequest,
  getCfIpCountry,
  extractGeoFieldsFromProviderJson,
};
