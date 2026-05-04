/**
 * Shared validation + API payload helpers for multiple-links QR (wizard + edit).
 */

export function validateLinkRows(linkRows) {
  if (!linkRows?.length) return 'Add at least one link.';
  for (const row of linkRows) {
    if (!row.value?.trim()) {
      return `Enter a value for “${row.label || row.kind}”.`;
    }
    if (row.kind === 'custom' && !row.label?.trim()) {
      return 'Each custom link needs a label.';
    }
  }
  return null;
}

/** PATCH/create body items — include linkId only when editing an existing row. */
export function rowsToApiLinkItems(linkRows) {
  return linkRows.map((r) => ({
    ...(r.linkId ? { linkId: r.linkId } : {}),
    kind: r.kind,
    label: (r.kind === 'custom' ? r.label.trim() : r.label).slice(0, 80),
    value: r.value.trim().slice(0, 500),
  }));
}

/** Hydrate editor state from GET /campaigns/:id linkItems. */
export function campaignLinkItemsToRows(linkItems) {
  return (linkItems || []).map((it) => ({
    key: it.linkId,
    linkId: it.linkId,
    kind: it.kind,
    label: it.label,
    value: it.value,
  }));
}

export const newRowKey = () =>
  `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
