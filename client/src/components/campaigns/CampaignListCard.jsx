import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, ScanLine, Calendar,
  MoreVertical, Pencil, Copy, Trash2, Play, Pause,
  BarChart3, ExternalLink,
} from 'lucide-react';
import Icon3D, { ICON3D_PRESETS } from '../ui/Icon3D';

export const resolveRedirectBase = () => {
  if (import.meta.env.VITE_REDIRECT_BASE) {
    return String(import.meta.env.VITE_REDIRECT_BASE).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-green-500/15 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    draft: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
};

const CardMenu = ({ campaign, onEdit, onDuplicate, onToggleStatus, onDelete, onOpenChange }) => {
  const [open, setOpen] = useState(false);
  const setMenuOpen = (next) => {
    setOpen(next);
    if (typeof onOpenChange === 'function') onOpenChange(next);
  };

  return (
    <div className={`relative ${open ? 'z-[120]' : 'z-10'}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!open);
        }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
        aria-label="More options"
        type="button"
      >
        <MoreVertical size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full right-0 z-[130] mb-1 w-44 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-1 shadow-xl sm:bottom-auto sm:top-full sm:mb-0 sm:mt-1"
            >
              {[
                { icon: Pencil, label: 'Edit', action: () => { setMenuOpen(false); onEdit(); } },
                { icon: Copy, label: 'Duplicate', action: () => { setMenuOpen(false); onDuplicate(); } },
                {
                  icon: campaign.status === 'active' ? Pause : Play,
                  label: campaign.status === 'active' ? 'Pause' : 'Activate',
                  action: () => { setMenuOpen(false); onToggleStatus(); },
                },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <Icon3D icon={Icon} size={10} className="h-5 w-5" accent={ICON3D_PRESETS.violet} rounded="rounded-md" />
                  {label}
                </button>
              ))}
              <div className="mx-2 my-1 border-t border-[var(--border-color)]" />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                <Icon3D icon={Trash2} size={10} className="h-5 w-5" accent={ICON3D_PRESETS.rose} rounded="rounded-md" />
                Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * @param {object} props
 * @param {function(object): string} [props.getCampaignHref] — Link target for card title + View (default `/dashboard/campaigns/:id`)
 * @param {string} [props.domId] — optional id on root element (e.g. scroll focus)
 * @param {string} [props.cardClassName] — extra classes on root card
 */
export const CampaignListCard = ({
  campaign,
  onEdit,
  onDuplicate,
  onToggleStatus,
  onDelete,
  getCampaignHref = (c) => `/dashboard/campaigns/${c._id}`,
  domId,
  cardClassName = '',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const isSingleLinkQr = campaign.campaignType === 'single-link-qr';
  const isMultiLinkQr =
    campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const isDigitalCard = campaign.campaignType === 'digital-business-card';
  const trackedRedirectUrl = campaign.redirectSlug
    ? `${resolveRedirectBase()}/r/${campaign.redirectSlug}`
    : null;
  const hubPageUrl = campaign.redirectSlug && typeof window !== 'undefined'
    ? `${window.location.origin}/l/${campaign.redirectSlug}`
    : campaign.redirectSlug
      ? `/l/${campaign.redirectSlug}`
      : null;
  const cardPublicUrl = isDigitalCard && campaign.cardSlug && typeof window !== 'undefined'
    ? `${window.location.origin}/card/${campaign.cardSlug}`
    : null;
  const quickAction = isDigitalCard
    ? (cardPublicUrl && campaign.status === 'active' ? (
      <a
        href={cardPublicUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
        aria-label="Open public card page"
        title="Open card page"
      >
        <ExternalLink size={14} />
        <span className="hidden sm:inline">Card</span>
      </a>
    ) : (
      <span
        className="inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] opacity-40"
        title={campaign.status !== 'active' ? 'Activate the card to open it' : 'No card slug configured'}
      >
        <ExternalLink size={14} />
      </span>
    ))
    : isSingleLinkQr
      ? (trackedRedirectUrl ? (
        <a
          href={trackedRedirectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          aria-label="Open tracked redirect link"
          title="Open Link"
        >
          <ExternalLink size={14} />
          <span className="hidden sm:inline">Link</span>
        </a>
      ) : (
        <span
          className="inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] opacity-40"
          title="No destination URL configured"
        >
          <ExternalLink size={14} />
        </span>
      ))
      : isMultiLinkQr
        ? (hubPageUrl && campaign.status === 'active' ? (
          <a
            href={hubPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
            aria-label="Open link hub page"
            title="Open link page"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Links</span>
          </a>
        ) : (
          <span
            className="inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] opacity-40"
            title={campaign.status !== 'active' ? 'Activate the campaign to open the link page' : 'No slug configured'}
          >
            <ExternalLink size={14} />
          </span>
        ))
        : (campaign.status === 'active' ? (
          <a
            href={`/ar/${campaign._id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
            aria-label="Preview AR experience"
            title="Preview AR"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">AR</span>
          </a>
        ) : (
          <span
            className="inline-flex min-h-[44px] min-w-[44px] cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] opacity-40"
            title="Activate the campaign to preview AR"
          >
            <ExternalLink size={14} />
          </span>
        ));

  const href = getCampaignHref(campaign);

  return (
    <motion.div
      id={domId}
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`glass-card group relative flex flex-col overflow-visible ${
        menuOpen ? 'z-[140]' : 'z-10'
      } ${cardClassName}`.trim()}
    >
      <div className="relative aspect-video overflow-hidden bg-[var(--surface-3)]">
        {campaign.thumbnailUrl ? (
          <img
            src={campaign.thumbnailUrl}
            alt={campaign.campaignName}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Icon3D icon={QrCode} size={18} className="h-10 w-10 opacity-70" accent={ICON3D_PRESETS.violet} />
          </div>
        )}
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge status={campaign.status} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={href}
            className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)] hover:text-brand-400"
          >
            {campaign.campaignName}
          </Link>
          <CardMenu
            campaign={campaign}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onToggleStatus={onToggleStatus}
            onDelete={onDelete}
            onOpenChange={setMenuOpen}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <ScanLine size={11} />
            {campaign.analytics?.totalScans ?? 0} scans
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {new Date(campaign.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div className="mt-auto flex gap-2 border-t border-[var(--border-color)] pt-3">
          <Link
            to={href}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          >
            <QrCode size={12} /> View
          </Link>
          <Link
            to={`/dashboard/campaigns/${campaign._id}/analytics`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          >
            <BarChart3 size={12} /> Stats
          </Link>
          {quickAction}
        </div>
      </div>
    </motion.div>
  );
};

export const CampaignListSkeletonCard = () => (
  <div className="glass-card overflow-hidden">
    <div className="aspect-video animate-pulse bg-[var(--surface-3)]" />
    <div className="space-y-3 p-4">
      <div className="h-4 w-3/4 animate-pulse rounded-lg bg-[var(--surface-3)]" />
      <div className="h-3 w-1/2 animate-pulse rounded-lg bg-[var(--surface-3)]" />
    </div>
  </div>
);
