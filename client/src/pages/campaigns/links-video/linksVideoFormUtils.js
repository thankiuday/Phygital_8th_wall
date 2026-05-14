import {
  validateLinkRows,
  rowsToApiLinkItems,
  mergeHubVisitorEmailLinkItems,
} from '../multiple-links/multiLinkFormUtils';
import { isAllowedVideoHost, toEmbedSrc } from '../../../utils/videoEmbed';

export const validateLinksVideoForm = ({
  campaignName,
  videoSource,
  uploadedVideoUrl,
  externalVideoUrl,
  linkRows,
}) => {
  const trimmedName = (campaignName || '').trim();
  if (!trimmedName) return 'Campaign name is required';
  if (trimmedName.length > 100) return 'Campaign name cannot exceed 100 characters';

  if (videoSource === 'upload') {
    if (!uploadedVideoUrl) return 'Upload a video to continue';
  } else if (videoSource === 'link') {
    if (!externalVideoUrl?.trim()) return 'Paste a video URL to continue';
    if (!isAllowedVideoHost(externalVideoUrl)) {
      return 'Only YouTube, Vimeo, or Facebook video URLs are supported';
    }
    if (!toEmbedSrc(externalVideoUrl)) {
      return 'Could not parse this video URL. Try a direct video page URL.';
    }
  } else {
    return 'Choose a video source';
  }

  return validateLinkRows(linkRows);
};

export const buildLinksVideoPayload = ({
  campaignName,
  videoSource,
  uploadedVideoUrl,
  uploadedVideoPublicId,
  uploadedVideoThumbnailUrl,
  externalVideoUrl,
  linkRows,
  preciseGeoAnalytics,
  visitorHubEmail,
}) => ({
  campaignName: campaignName.trim(),
  videoSource,
  ...(videoSource === 'upload'
    ? {
      videoUrl: uploadedVideoUrl,
      videoPublicId: uploadedVideoPublicId || undefined,
      thumbnailUrl: uploadedVideoThumbnailUrl || undefined,
    }
    : {
      externalVideoUrl: externalVideoUrl.trim(),
    }),
  linkItems: mergeHubVisitorEmailLinkItems(rowsToApiLinkItems(linkRows), visitorHubEmail),
  preciseGeoAnalytics: !!preciseGeoAnalytics,
});

