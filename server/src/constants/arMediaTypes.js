'use strict';

const AR_MEDIA_TYPES = Object.freeze(['ar-card', 'ar-poster']);

const isArMediaType = (type) => AR_MEDIA_TYPES.includes(type);

const AR_MEDIA_LABELS = Object.freeze({
  'ar-card': 'AR Card',
  'ar-poster': 'AR Poster',
});

const getArMediaLabel = (type) => AR_MEDIA_LABELS[type] || 'AR';

module.exports = {
  AR_MEDIA_TYPES,
  isArMediaType,
  AR_MEDIA_LABELS,
  getArMediaLabel,
};
