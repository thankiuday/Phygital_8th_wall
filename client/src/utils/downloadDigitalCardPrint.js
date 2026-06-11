import { DEFAULT_CARD_SIZE } from '../components/card/cardSizes';
import { campaignService } from '../services/campaignService';
import { downloadImageBlob } from './compositeQrOnCardImage';

const safeSlug = (campaign) =>
  String(campaign?.cardSlug || campaign?._id || 'card').replace(/[^\w.-]+/g, '-');

/**
 * Download front + back print PNGs for a saved digital business card.
 * Uses the authenticated API file stream so files save to disk reliably.
 */
export async function downloadDigitalCardFaces(campaign) {
  const id = campaign?._id;
  if (!id) throw new Error('Campaign not found.');

  const cardSize = campaign.cardPrintSettings?.cardSize || DEFAULT_CARD_SIZE;
  const slug = safeSlug(campaign);

  const frontBlob = await campaignService.downloadCardImageFile(id, {
    face: 'front',
    size: cardSize,
  });
  downloadImageBlob(frontBlob, `card-${slug}-${cardSize}-front.png`);

  await new Promise((resolve) => { setTimeout(resolve, 350); });

  const backBlob = await campaignService.downloadCardImageFile(id, {
    face: 'back',
    size: cardSize,
  });
  downloadImageBlob(backBlob, `card-${slug}-${cardSize}-back.png`);
}
