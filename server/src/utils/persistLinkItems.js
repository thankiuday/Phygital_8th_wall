'use strict';

const { resolveLinkHref } = require('./linkItemResolver');

const trimLinkLogoField = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
};

const attachLinkLogoFields = (row, item) => {
  if (item.kind !== 'custom') return row;
  const logoUrl = trimLinkLogoField(item.logoUrl);
  const logoPublicId = trimLinkLogoField(item.logoPublicId);
  if (logoUrl && logoPublicId) {
    row.logoUrl = logoUrl;
    row.logoPublicId = logoPublicId;
  } else if (
    Object.prototype.hasOwnProperty.call(item, 'logoUrl')
    || Object.prototype.hasOwnProperty.call(item, 'logoPublicId')
  ) {
    row.logoUrl = null;
    row.logoPublicId = null;
  }
  return row;
};

/**
 * Build persisted hub link rows with new linkIds (create flows).
 */
const persistLinkItemsFromBody = async (linkItems) => {
  const { nanoid } = await import('nanoid');
  const persistedItems = [];
  for (const item of linkItems || []) {
    const row = {
      linkId: nanoid(12),
      kind: item.kind,
      label: item.label.trim(),
      value: item.value.trim(),
    };
    attachLinkLogoFields(row, item);
    resolveLinkHref(row.kind, row.value);
    persistedItems.push(row);
  }
  return persistedItems;
};

module.exports = { persistLinkItemsFromBody, attachLinkLogoFields, trimLinkLogoField };
