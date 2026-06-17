/**
 * arTargetCopy — dynamic hints for image-target vs surface placement modes.
 */

export const usesImageTarget = (campaign) => campaign?.requiresImageTarget !== false;

export const getArTargetNoun = (campaignType) =>
  (campaignType === 'ar-poster' ? 'poster' : 'business card');

export const getLoadingHint = (campaignType, requiresImageTarget = true) => {
  if (requiresImageTarget === false) {
    return 'Find a flat empty surface once the AR experience is ready.';
  }
  const noun = getArTargetNoun(campaignType);
  return `Point your camera at the ${noun} once the AR experience is ready.`;
};

export const getScanImageAlt = (campaignType, campaignName, requiresImageTarget = true) => {
  if (requiresImageTarget === false) {
    return 'Find a flat empty surface';
  }
  if (campaignName) {
    return `Point your camera at ${campaignName}`;
  }
  const noun = getArTargetNoun(campaignType);
  return `Point your camera at this ${noun}`;
};

export const getScanHintPrefix = (campaignType, requiresImageTarget = true) => {
  if (requiresImageTarget === false) {
    return 'Slowly move your phone over a flat empty surface';
  }
  const noun = getArTargetNoun(campaignType);
  return `Point your camera at your ${noun}`;
};

export const getScanTitle = (requiresImageTarget = true) =>
  (requiresImageTarget === false ? 'Find a flat surface' : 'Scan this image');

export const getSurfaceTapHint = () =>
  'Tap the indicator to place the hologram';

export const checkWebXrArSupported = async () => {
  if (!navigator.xr?.isSessionSupported) return false;
  try {
    return await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    return false;
  }
};
