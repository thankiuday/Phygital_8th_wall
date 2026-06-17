/**
 * Public AR landing page copy keyed by campaign type and tracking mode.
 */

const IMAGE_COPY = {
  'ar-poster': {
    target: 'AR poster',
    targetShort: 'poster',
    badge: 'AR Hologram Ready',
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
    badge: 'AR Hologram Ready',
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

const SURFACE_COPY = {
  'ar-poster': {
    target: 'flat surface',
    targetShort: 'surface',
    badge: 'Surface AR Ready',
    subtitle:
      'Find any flat empty surface — no printed poster needed. Place the hologram and watch it play.',
    seoDescription:
      'Place a hologram on any flat surface with WebXR — no printed marker required.',
    steps: [
      'Hold your phone and slowly move it over a flat empty surface',
      'Wait for the placement indicator to appear on the surface',
      'Tap to place the hologram — video plays automatically',
    ],
  },
  'ar-card': {
    target: 'flat surface',
    targetShort: 'surface',
    badge: 'Surface AR Ready',
    subtitle:
      'Find any flat empty surface — no business card needed. Place the hologram and watch it play.',
    seoDescription:
      'Place a hologram on any flat surface with WebXR — no printed marker required.',
    steps: [
      'Hold your phone and slowly move it over a flat empty surface',
      'Wait for the placement indicator to appear on the surface',
      'Tap to place the hologram — video plays automatically',
    ],
  },
};

const DEFAULT_KEY = 'ar-card';

export const getArExperienceCopy = (campaignType, requiresImageTarget = true) => {
  const table = requiresImageTarget !== false ? IMAGE_COPY : SURFACE_COPY;
  return table[campaignType] || table[DEFAULT_KEY];
};

export const getArExperienceSteps = (campaignType, requiresImageTarget = true) => {
  const { steps } = getArExperienceCopy(campaignType, requiresImageTarget);
  return steps;
};
