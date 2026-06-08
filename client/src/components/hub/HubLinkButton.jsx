import { motion } from 'framer-motion';
import {
  Phone,
  MessageCircle,
  AtSign,
  Users,
  Feather,
  Briefcase,
  Globe,
  Music2,
  Link2,
  Mail,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

export const HUB_LINK_KIND_ICONS = {
  contact: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  instagram: AtSign,
  facebook: Users,
  twitter: Feather,
  linkedin: Briefcase,
  website: Globe,
  tiktok: Music2,
  custom: Link2,
};

/** Per-kind accent colours for icon pills */
const KIND_ACCENT = {
  contact: 'bg-violet-500/15 text-violet-400',
  whatsapp: 'bg-emerald-500/15 text-emerald-400',
  email: 'bg-sky-500/15 text-sky-400',
  instagram: 'bg-pink-500/15 text-pink-400',
  facebook: 'bg-blue-500/15 text-blue-400',
  twitter: 'bg-slate-400/15 text-slate-300',
  linkedin: 'bg-blue-600/15 text-blue-400',
  website: 'bg-brand-500/15 text-brand-400',
  tiktok: 'bg-fuchsia-500/15 text-fuchsia-400',
  custom: 'bg-brand-500/15 text-brand-400',
};

const usesExternalIcon = (kind) => kind === 'website' || kind === 'custom';

/**
 * Tappable link row for public hub pages.
 */
const HubLinkButton = ({ link, onActivate, index = 0 }) => {
  const kind = link.kind || 'custom';
  const Icon = HUB_LINK_KIND_ICONS[kind] || Link2;
  const accent = KIND_ACCENT[kind] || KIND_ACCENT.custom;
  const TrailingIcon = usesExternalIcon(kind) ? ExternalLink : ChevronRight;

  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut', delay: index * 0.05 }}
    >
      <button
        type="button"
        onClick={() => onActivate(link)}
        className="flex w-full min-h-[52px] items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3.5 text-left shadow-sm transition-all duration-200 hover:border-brand-500/40 hover:bg-[var(--surface-2)] hover:shadow-md active:scale-[0.98] md:min-h-[56px] md:px-5 md:py-4"
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl md:h-12 md:w-12 ${accent}`}
        >
          <Icon className="h-5 w-5 md:h-[22px] md:w-[22px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 font-medium text-[var(--text-primary)] md:text-base">
          {link.label}
        </span>
        <TrailingIcon size={16} className="shrink-0 text-[var(--text-muted)]" aria-hidden />
      </button>
    </motion.li>
  );
};

export default HubLinkButton;
