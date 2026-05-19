import { QrCode } from 'lucide-react';
import {
  pickCampaignImageThumbUrl,
  pickCampaignVideoPreviewUrl,
} from '../../utils/assetUrl';

/**
 * Campaign card / preview media — image thumb, video frame fallback, or placeholder.
 */
const CampaignThumbnail = ({
  campaign,
  alt = '',
  className = 'h-full w-full object-cover',
  placeholderClassName = 'flex h-full w-full items-center justify-center bg-[var(--surface-3)]',
}) => {
  const imageSrc = pickCampaignImageThumbUrl(campaign);
  const videoSrc = pickCampaignVideoPreviewUrl(campaign);
  const label = alt || campaign?.campaignName || 'Campaign';

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={label}
        className={className}
        loading="lazy"
      />
    );
  }

  if (videoSrc) {
    return (
      <video
        src={videoSrc}
        muted
        playsInline
        preload="metadata"
        aria-label={label}
        className={className}
      />
    );
  }

  return (
    <div className={placeholderClassName} aria-hidden>
      <QrCode size={40} className="text-[var(--text-muted)] opacity-50" />
    </div>
  );
};

export default CampaignThumbnail;
