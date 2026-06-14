/**
 * Dynamic AR copy based on campaign type (card vs poster).
 */

export const getArTargetNoun = (campaignType) =>
  (campaignType === 'ar-poster' ? 'poster' : 'business card');

export const getLoadingHint = (campaignType) => {
  const noun = getArTargetNoun(campaignType);
  return `Point your camera at the ${noun} once the AR experience is ready.`;
};

export const getScanImageAlt = (campaignType, campaignName) => {
  if (campaignName) {
    return `Point your camera at ${campaignName}`;
  }
  const noun = getArTargetNoun(campaignType);
  return `Point your camera at this ${noun}`;
};

export const getScanHintPrefix = (campaignType) => {
  const noun = getArTargetNoun(campaignType);
  return `Point your camera at your ${noun}`;
};
