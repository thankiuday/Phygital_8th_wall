import { resolvePlaybackMediaUrl } from './assetUrl';

export const resolveRequestImageUrl = (request) => {
  if (!request?.targetImageUrl) return null;
  return resolvePlaybackMediaUrl(request.targetImageUrl);
};

export const resolveRequestVideoUrl = (request) => {
  if (!request?.greenscreenVideoUrl) return null;
  return resolvePlaybackMediaUrl(request.greenscreenVideoUrl);
};

const downloadFilename = (request) => {
  const email = request?.userId?.email || 'user';
  const local = String(email).split('@')[0].replace(/[^a-z0-9_-]+/gi, '-').slice(0, 24);
  const id = String(request?._id || 'request').slice(-6);
  return `greenscreen-${local || 'user'}-${id}.mp4`;
};

/**
 * Download user's green-screen MP4 via the API media proxy (private S3).
 */
export const downloadGreenscreenVideo = async (request) => {
  const url = resolveRequestVideoUrl(request);
  if (!url) throw new Error('No green-screen video on this request');

  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download video');

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = downloadFilename(request);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
};
