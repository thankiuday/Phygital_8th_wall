'use strict';

const { resolveLinkHref } = require('./linkItemResolver');

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
    resolveLinkHref(row.kind, row.value);
    persistedItems.push(row);
  }
  return persistedItems;
};

module.exports = { persistLinkItemsFromBody };
