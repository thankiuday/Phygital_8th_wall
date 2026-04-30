'use strict';

/**
 * safeUrl — hardened URL validator/normalizer for destinationUrl.
 *
 * Defends against:
 *  - Wrong scheme  (javascript:, data:, file:, vbscript:, ftp:, etc.)
 *  - SSRF via private/loopback/link-local literals (RFC 1918, RFC 6598, etc.)
 *
 * Cannot defend against DNS rebinding because the *browser* resolves the host
 * at scan time, not us — that is an acceptable trade-off for a 302-redirect
 * service. If we ever fetch the URL server-side we must re-resolve and re-check.
 *
 * API
 *   const { safeUrl } = require('./safeUrl');
 *   safeUrl('example.com')           → 'https://example.com/'
 *   safeUrl('http://10.0.0.1')       → throws RangeError
 *   safeUrl('javascript:alert(1)')   → throws RangeError
 *
 * Designed to be wrapped in `z.string().refine()` for use inside Zod schemas;
 * it returns the *normalized* URL string, suitable for storage.
 */

// ── IPv4 / IPv6 helpers ─────────────────────────────────────────────────────

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

const ipv4ToInt = (ip) =>
  ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;

// CIDRs we refuse to redirect to.  Stored as [networkInt, prefixLen].
const BLOCKED_V4_CIDRS = [
  ['0.0.0.0',     8],   // current network
  ['10.0.0.0',    8],   // RFC 1918
  ['100.64.0.0',  10],  // RFC 6598 (carrier-grade NAT)
  ['127.0.0.0',   8],   // loopback
  ['169.254.0.0', 16],  // link-local (incl. AWS / GCP metadata)
  ['172.16.0.0',  12],  // RFC 1918
  ['192.0.0.0',   24],  // IETF protocol assignments
  ['192.168.0.0', 16],  // RFC 1918
  ['198.18.0.0',  15],  // benchmarking
  ['224.0.0.0',   4],   // multicast
  ['240.0.0.0',   4],   // reserved
].map(([net, len]) => [ipv4ToInt(net), len]);

const isPrivateV4 = (ip) => {
  const ipInt = ipv4ToInt(ip);
  return BLOCKED_V4_CIDRS.some(([net, prefix]) => {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (net & mask);
  });
};

const isPrivateV6 = (host) => {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::' || h === '::1') return true;            // unspecified / loopback
  if (h.startsWith('fe80:')) return true;                 // link-local
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // ULA (fc00::/7)
  if (h.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — extract the v4 portion and recheck
    const v4 = h.slice('::ffff:'.length);
    if (IPV4_RE.test(v4)) return isPrivateV4(v4);
  }
  return false;
};

// Hostnames we always reject regardless of scheme/port
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'broadcasthost',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
]);

/**
 * safeUrl(input) — returns the normalized https URL or throws RangeError.
 *
 * Normalization:
 *  - Prepends `https://` when scheme is missing (not when `://` is present)
 *  - Lowercases the host
 *  - Strips default ports (80 for http, 443 for https)
 *  - Drops the URL fragment
 */
const safeUrl = (input) => {
  if (typeof input !== 'string' || input.trim().length === 0) {
    throw new RangeError('URL is required');
  }

  let raw = input.trim();
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) {
    raw = `https://${raw}`;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new RangeError('URL is malformed');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new RangeError(`Unsupported scheme: ${url.protocol.replace(':', '')}`);
  }

  const host = url.hostname.toLowerCase();
  if (!host) throw new RangeError('URL host is empty');

  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new RangeError(`Host '${host}' is not allowed`);
  }

  if (IPV4_RE.test(host)) {
    if (isPrivateV4(host)) {
      throw new RangeError(`IPv4 address '${host}' is in a blocked range`);
    }
  } else if (host.includes(':')) {
    // Likely IPv6 (URL.hostname strips the brackets)
    if (isPrivateV6(host)) {
      throw new RangeError(`IPv6 address '${host}' is in a blocked range`);
    }
  }

  url.hostname = host;
  if ((url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')) {
    url.port = '';
  }
  url.hash = '';

  return url.toString();
};

module.exports = { safeUrl };
