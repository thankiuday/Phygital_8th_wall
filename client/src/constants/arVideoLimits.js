/** Max hologram / green-screen clip length for AR card and AR poster campaigns. */
export const AR_VIDEO_MAX_DURATION_SEC = 120;

export const arVideoDurationHint = () =>
  `Max ${Math.round(AR_VIDEO_MAX_DURATION_SEC / 60)} minutes`;
