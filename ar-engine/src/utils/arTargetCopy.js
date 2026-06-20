/**
 * arTargetCopy — dynamic hints for image-target vs surface placement modes.
 */

import { isApplePlaybackEngine } from './platform.js';

export const usesImageTarget = (campaign) => campaign?.requiresImageTarget !== false;

/** Runtime mode: iOS uses image tracking even when campaign is surface-only. */
export const effectiveUsesImageTarget = (campaign) => {
  if (usesImageTarget(campaign)) return true;
  return isApplePlaybackEngine();
};

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
  'Tap the purple ring to place the hologram';

export const getSurfaceCoachingCopy = (phase) => {
  switch (phase) {
    case 'starting':
      return 'Tap anywhere to start the camera';
    case 'scanning':
      return 'Slowly move your phone over a flat empty surface';
    case 'ready':
      return 'Tap the purple ring to place the hologram';
    default:
      return 'Find a flat surface to place your hologram';
  }
};

export { checkWebXrArSupported } from './webxr.js';
