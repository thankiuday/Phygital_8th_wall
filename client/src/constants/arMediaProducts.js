export const AR_MEDIA_PRODUCTS = {
  'ar-card': {
    requestKind: 'ar-card',
    campaignType: 'ar-card',
    label: 'AR Digital Business Card',
    shortLabel: 'AR Card',
    wizardRoute: '/dashboard/campaigns/new/digital-business-card/ar',
    imageStepLabel: 'Card Image',
    qrStepLabel: 'Place QR',
    assetNoun: 'card',
    printAssetLabel: 'print-ready card',
    slaTitle: 'AR Digital Business Card',
    slaDescription:
      'Submit your card image, QR placement, and green-screen video — we build your holographic AR card within 24 hours.',
    defaultCampaignSuffix: 'AR Card',
  },
  'ar-poster': {
    requestKind: 'ar-poster',
    campaignType: 'ar-poster',
    label: 'AR Posters',
    shortLabel: 'AR Poster',
    wizardRoute: '/dashboard/campaigns/new/ar-poster',
    imageStepLabel: 'Poster Image',
    qrStepLabel: 'Place QR on poster',
    assetNoun: 'poster',
    printAssetLabel: 'print-ready poster',
    slaTitle: 'AR Posters',
    slaDescription:
      'Submit your poster artwork, QR placement, and green-screen video — we build your holographic AR poster within 24 hours.',
    defaultCampaignSuffix: 'AR Poster',
  },
};

export const AR_MEDIA_TYPES = Object.freeze(['ar-card', 'ar-poster']);

export const isArMediaType = (type) => AR_MEDIA_TYPES.includes(type);

export const getArMediaProduct = (key) =>
  AR_MEDIA_PRODUCTS[key] || AR_MEDIA_PRODUCTS['ar-card'];
