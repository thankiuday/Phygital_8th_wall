import { resolvePlaybackMediaUrl } from '../../utils/assetUrl';
import { HUB_LINK_KIND_ICONS } from './HubLinkButton';
import { Link2 } from 'lucide-react';

/**
 * Renders a custom-link logo or the default kind icon.
 */
const LinkIconCircle = ({ link, size = 20, className = '' }) => {
  const kind = link?.kind || 'custom';
  const showLogo = kind === 'custom' && link?.logoUrl;

  if (showLogo) {
    const src = resolvePlaybackMediaUrl(link.logoUrl);
    if (src) {
      return (
        <img
          src={src}
          alt=""
          aria-hidden
          className={`rounded-full object-cover ${className}`}
          style={{ width: size, height: size }}
        />
      );
    }
  }

  const Icon = HUB_LINK_KIND_ICONS[kind] || Link2;
  return <Icon className={className} style={{ width: size, height: size }} aria-hidden />;
};

export default LinkIconCircle;
