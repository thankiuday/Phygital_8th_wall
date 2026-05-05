import { validateLinkRows, rowsToApiLinkItems } from '../multiple-links/multiLinkFormUtils';
import { isAllowedVideoHost, toEmbedSrc } from '../../../utils/videoEmbed';

export const MAX_VIDEO_SLOTS = 5;
export const MAX_DOC_SLOTS = 5;

/** Server-side allowlist mirrored on the client for UX (early validation). */
export const ALLOWED_DOC_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
];

export const DOC_ACCEPT_STRING = ALLOWED_DOC_MIME_TYPES.join(',');
export const DOC_ACCEPT_LABEL = 'PDF, DOCX, PPTX, XLSX, JPG, PNG';
export const MAX_DOC_BYTES = 25 * 1024 * 1024;
export const MAX_DOC_MB = 25;

/**
 * Each video slot tracks both upload and link state so toggling the campaign
 * source mode never silently discards the asset metadata the user already
 * provided in the other mode.
 */
export const createVideoSlot = (overrides = {}) => ({
  uid: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  label: '',
  uploadUrl: '',
  uploadPublicId: '',
  uploadThumbnailUrl: '',
  externalUrl: '',
  ...overrides,
});

export const createDocSlot = (overrides = {}) => ({
  uid: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  label: '',
  url: '',
  publicId: '',
  mimeType: '',
  bytes: 0,
  resourceType: 'raw',
  fileName: '',
  ...overrides,
});

/**
 * Returns true when the slot has the bits the campaign-wide source needs:
 *   - upload mode → an uploaded videoUrl
 *   - link  mode → a parseable allowed video URL
 */
export const isVideoSlotReady = (slot, source) => {
  if (!slot) return false;
  if (source === 'upload') {
    return !!(slot.uploadUrl && (slot.label || '').trim());
  }
  if (source === 'link') {
    const url = (slot.externalUrl || '').trim();
    if (!url || !(slot.label || '').trim()) return false;
    return !!(isAllowedVideoHost(url) && toEmbedSrc(url));
  }
  return false;
};

export const isDocSlotReady = (slot) =>
  !!(slot && slot.url && (slot.label || '').trim());

export const validateLinksDocVideoForm = ({
  campaignName,
  videoSource,
  videoSlots,
  docSlots,
  linkRows,
}) => {
  const trimmedName = (campaignName || '').trim();
  if (!trimmedName) return 'Campaign name is required';
  if (trimmedName.length > 100) return 'Campaign name cannot exceed 100 characters';

  if (!['upload', 'link'].includes(videoSource)) {
    return 'Choose a video source';
  }

  if (videoSlots.length > MAX_VIDEO_SLOTS) {
    return `You can add up to ${MAX_VIDEO_SLOTS} videos`;
  }
  if (docSlots.length > MAX_DOC_SLOTS) {
    return `You can add up to ${MAX_DOC_SLOTS} documents`;
  }

  // Each occupied slot must be complete (the wizard prevents adding empty rows
  // it can't fulfil, but a user could leave a half-filled row behind).
  for (const slot of videoSlots) {
    const hasAnything =
      slot.uploadUrl
      || slot.externalUrl?.trim()
      || (slot.label || '').trim();
    if (!hasAnything) continue;
    if (!isVideoSlotReady(slot, videoSource)) {
      if (videoSource === 'upload') return 'Finish uploading every video, or remove unfinished rows';
      const url = (slot.externalUrl || '').trim();
      if (!url) return 'Add a video URL or remove the empty slot';
      if (!isAllowedVideoHost(url) || !toEmbedSrc(url)) {
        return 'Only YouTube, Vimeo, or Facebook video URLs are supported';
      }
      return 'Each video needs a label';
    }
  }

  for (const slot of docSlots) {
    const hasAnything = slot.url || (slot.label || '').trim() || slot.fileName;
    if (!hasAnything) continue;
    if (!isDocSlotReady(slot)) return 'Finish uploading every document, or remove unfinished rows';
  }

  const readyVideos = videoSlots.filter((s) => isVideoSlotReady(s, videoSource));
  const readyDocs = docSlots.filter(isDocSlotReady);
  if (readyVideos.length === 0 && readyDocs.length === 0) {
    return 'Add at least one video or document';
  }

  return validateLinkRows(linkRows);
};

export const buildLinksDocVideoPayload = ({
  campaignName,
  videoSource,
  videoSlots,
  docSlots,
  linkRows,
  preciseGeoAnalytics,
}) => {
  const videoItems = videoSlots
    .filter((slot) => isVideoSlotReady(slot, videoSource))
    .map((slot) => {
      const base = {
        label: slot.label.trim(),
        source: videoSource,
      };
      if (videoSource === 'upload') {
        return {
          ...base,
          url: slot.uploadUrl,
          publicId: slot.uploadPublicId || undefined,
          thumbnailUrl: slot.uploadThumbnailUrl || undefined,
        };
      }
      return {
        ...base,
        externalVideoUrl: slot.externalUrl.trim(),
      };
    });

  const docItems = docSlots
    .filter(isDocSlotReady)
    .map((slot) => ({
      label: slot.label.trim(),
      url: slot.url,
      publicId: slot.publicId || undefined,
      mimeType: slot.mimeType || undefined,
      bytes: typeof slot.bytes === 'number' ? slot.bytes : undefined,
      resourceType: slot.resourceType === 'image' ? 'image' : 'raw',
    }));

  return {
    campaignName: campaignName.trim(),
    videoSource,
    videoItems,
    docItems,
    linkItems: rowsToApiLinkItems(linkRows),
    preciseGeoAnalytics: !!preciseGeoAnalytics,
  };
};

/** Best-effort, label-from-file-name helper. */
export const labelFromFileName = (fileName = '') =>
  fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 80);
