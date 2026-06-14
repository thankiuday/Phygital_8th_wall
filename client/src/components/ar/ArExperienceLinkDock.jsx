import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link2 } from 'lucide-react';
import publicApi from '../../services/publicApi';
import { getVisitorHashForCampaign } from '../../utils/visitorHash';
import { HUB_LINK_KIND_ICONS } from '../hub/HubLinkButton';

const STAGGER_SEC = 0.3;

const KIND_ACCENT = {
  contact: 'bg-violet-500/25 text-violet-300 ring-violet-400/30',
  whatsapp: 'bg-emerald-500/25 text-emerald-300 ring-emerald-400/30',
  email: 'bg-sky-500/25 text-sky-300 ring-sky-400/30',
  instagram: 'bg-pink-500/25 text-pink-300 ring-pink-400/30',
  facebook: 'bg-blue-500/25 text-blue-300 ring-blue-400/30',
  twitter: 'bg-slate-400/20 text-slate-200 ring-slate-400/25',
  linkedin: 'bg-blue-600/25 text-blue-300 ring-blue-500/30',
  website: 'bg-brand-500/25 text-brand-300 ring-brand-400/30',
  tiktok: 'bg-fuchsia-500/25 text-fuchsia-300 ring-fuchsia-400/30',
  custom: 'bg-brand-500/25 text-brand-300 ring-brand-400/30',
};

const layoutClassForCount = (count) => {
  if (count === 1) return 'justify-center';
  if (count >= 2 && count <= 4) return 'justify-center';
  return 'justify-start overflow-x-auto scrollbar-none';
};

const openLinkHref = (href) => {
  const h = String(href || '');
  if (/^(tel:|mailto:)/i.test(h)) {
    window.location.href = h;
    return;
  }
  window.open(h, '_blank', 'noopener,noreferrer');
};

/**
 * Glass bottom dock preview for AR landing page — mirrors live ar-engine layout.
 */
const ArExperienceLinkDock = ({ links = [], redirectSlug, className = '' }) => {
  const count = links.length;
  if (count === 0) return null;

  const onActivate = useCallback(
    (link) => {
      if (redirectSlug && link.linkId) {
        const visitorHash = getVisitorHashForCampaign(redirectSlug);
        publicApi
          .post(`/public/multi-link/${encodeURIComponent(redirectSlug)}/click`, {
            linkId: link.linkId,
            kind: 'link',
            visitorHash: visitorHash || undefined,
          })
          .catch(() => {});
      }
      openLinkHref(link.href);
    },
    [redirectSlug]
  );

  return (
    <div className={`w-full ${className}`}>
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
        Quick links
      </p>
      <div
        className={`mx-auto flex w-fit max-w-full items-center gap-2.5 rounded-full border border-violet-500/25 bg-[rgba(12,8,24,0.75)] px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md ${layoutClassForCount(count)}`}
      >
        {links.map((link, index) => {
          const kind = link.kind || 'custom';
          const Icon = HUB_LINK_KIND_ICONS[kind] || Link2;
          const accent = KIND_ACCENT[kind] || KIND_ACCENT.custom;

          return (
            <motion.button
              key={link.linkId || `${kind}-${index}`}
              type="button"
              initial={{ opacity: 0, y: 14, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.35,
                delay: index * STAGGER_SEC,
                ease: [0.34, 1.45, 0.64, 1],
              }}
              whileTap={{ scale: 0.92 }}
              onClick={() => onActivate(link)}
              aria-label={link.label || kind}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${accent}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default ArExperienceLinkDock;
