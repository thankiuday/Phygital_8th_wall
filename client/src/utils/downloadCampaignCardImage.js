import { resolvePlaybackMediaUrl } from './assetUrl';
import { downloadImageBlob } from './compositeQrOnCardImage';

const safeFilename = (name) =>
  String(name || 'ar-card')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .slice(0, 60);

/**
 * Download the campaign's print / AR marker image (composited card with QR when set).
 */
export async function downloadCompositedCardImage(campaign) {
  const rawUrl = campaign?.targetImageUrl;
  if (!rawUrl) throw new Error('No print card image is available for this campaign yet.');

  const url = resolvePlaybackMediaUrl(rawUrl);
  const res = await fetch(url);
  if (!res.ok) throw new Error('Could not download the card image. Try again in a moment.');

  const blob = await res.blob();
  downloadImageBlob(blob, `${safeFilename(campaign.campaignName)}-print-with-qr.png`);
}
