/**
 * Public AR landing page copy keyed by campaign type.
 */

const COPY = {
  'ar-poster': {
    target: 'AR poster',
    targetShort: 'poster',
    subtitle:
      'Point your camera at the AR poster to unlock the hologram and interactive links.',
    seoDescription:
      'Point your camera at the AR poster to launch the hologram experience.',
    steps: [
      'Keep your poster flat on a wall or surface',
      'Point your phone camera directly at the poster',
      'Hold still — the hologram will appear in seconds',
    ],
  },
  'ar-card': {
    target: 'business card',
    targetShort: 'business card',
    subtitle:
      'Point your camera at the business card to unlock the hologram and interactive links.',
    seoDescription:
      'Point your camera at the business card to launch the hologram experience.',
    steps: [
      'Keep your business card flat on a surface',
      'Point your phone camera directly at the card',
      'Hold still — the hologram will appear in seconds',
    ],
  },
};

const DEFAULT_KEY = 'ar-card';

export const getArExperienceCopy = (campaignType) =>
  COPY[campaignType] || COPY[DEFAULT_KEY];

export const getArExperienceSteps = (campaignType) => {
  const { steps } = getArExperienceCopy(campaignType);
  return steps;
};
