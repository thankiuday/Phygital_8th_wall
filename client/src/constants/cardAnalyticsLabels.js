/** Display labels for digital-business-card analytics action keys. */
export const CARD_ACTION_LABELS = {
  call: 'Phone call',
  email: 'Email',
  whatsapp: 'WhatsApp',
  website: 'Website',
  address: 'Address',
  social: 'Social',
  galleryView: 'Gallery view',
  videoPlay: 'Video play',
  docOpen: 'Document open',
  cta: 'Custom link',
  'print-download': 'Print download',
};

export const formatGeoSource = (source) => {
  if (source === 'browser') return 'GPS';
  if (source === 'hybrid') return 'Hybrid';
  return 'IP';
};

/** Aggregate location rows by country for bar charts. */
export const aggregateCountriesFromLocations = (locations) => {
  const map = new Map();
  for (const row of locations || []) {
    const country = row.country || 'Unknown';
    const prev = map.get(country) || { country, scans: 0, uniqueVisitors: 0 };
    prev.scans += row.scans || 0;
    prev.uniqueVisitors += row.uniqueVisitors || 0;
    map.set(country, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.scans - a.scans).slice(0, 10);
};
