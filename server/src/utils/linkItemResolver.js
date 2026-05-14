'use strict';

const { safeUrl } = require('../validators/safeUrl');

const LINK_KINDS = new Set([
  'contact',
  'whatsapp',
  'instagram',
  'facebook',
  'twitter',
  'linkedin',
  'website',
  'tiktok',
  'email',
  'custom',
]);

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

const normalizePhone = (raw) => {
  const d = digitsOnly(raw);
  if (d.length < 5 || d.length > 15) {
    throw new RangeError('Phone number length is invalid');
  }
  return d;
};

const handleFromValue = (raw) => {
  const h = String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .replace(/[^\w.-]/g, '')
    .slice(0, 80);
  if (!h) throw new RangeError('Handle is required');
  return h;
};

/**
 * Build outbound href for a stored link item (kind + value).
 * Throws RangeError on invalid input (same family as safeUrl).
 */
const resolveLinkHref = (kind, value) => {
  if (!LINK_KINDS.has(kind)) {
    throw new RangeError('Invalid link kind');
  }
  const v = String(value ?? '').trim();
  if (!v) throw new RangeError('Link value is required');

  switch (kind) {
    case 'contact': {
      const num = normalizePhone(v);
      return `tel:+${num}`;
    }
    case 'whatsapp': {
      const num = normalizePhone(v);
      return `https://wa.me/${num}`;
    }
    case 'instagram':
      return `https://instagram.com/${handleFromValue(v)}`;
    case 'facebook':
      return `https://facebook.com/${handleFromValue(v)}`;
    case 'twitter':
      return `https://twitter.com/${handleFromValue(v)}`;
    case 'linkedin': {
      if (/^https?:\/\//i.test(v)) return safeUrl(v);
      const h = handleFromValue(v);
      return `https://linkedin.com/in/${h}`;
    }
    case 'tiktok':
      return `https://www.tiktok.com/@${handleFromValue(v)}`;
    case 'email': {
      const addr = String(v)
        .replace(/^mailto:/i, '')
        .split('?')[0]
        .trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
        throw new RangeError('Invalid email address');
      }
      return `mailto:${addr}`;
    }
    case 'website':
    case 'custom':
      return safeUrl(v);
    default:
      throw new RangeError('Unsupported kind');
  }
};

/**
 * @param {Array<{ linkId: string, kind: string, label: string, value: string }>} items
 * @returns {Array<{ linkId: string, label: string, href: string }>}
 */
const toPublicLinkList = (items) => {
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items) {
    try {
      const href = resolveLinkHref(it.kind, it.value);
      out.push({
        linkId: it.linkId,
        kind: it.kind,
        label: String(it.label || it.kind).slice(0, 80),
        href,
      });
    } catch {
      /* skip malformed rows — should not happen if validated on write */
    }
  }
  return out;
};

module.exports = {
  LINK_KINDS,
  resolveLinkHref,
  toPublicLinkList,
};
