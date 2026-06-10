import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, Calendar,
  MoreVertical, Pencil, Copy, Trash2, Play, Pause,
  BarChart3, ExternalLink, Download, Loader2, Sparkles,
} from 'lucide-react';
import { downloadCompositedCardImage } from '../../utils/downloadCampaignCardImage';
import Icon3D, { ICON3D_PRESETS } from '../ui/Icon3D';
import CampaignThumbnail from '../ui/CampaignThumbnail';
import { arEffectLabel } from '../../constants/arEffects';
import {
  arPreviewUrl,
  campaignTypeLabel,
  canPreviewAr,
  hasPrintAsset,
  hubPublicUrl,
  isArMediaType,
  isDynamicQrType,
  isHubQrType,
  primaryOpenUrl,
} from '../../utils/campaignActions';

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
  const [downloadBusy, setDownloadBusy] = useState(false);
  const setMenuOpen = (next) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  const handleDownloadPrint = async () => {
    setDownloadBusy(true);
    try {
      await downloadCompositedCardImage(campaign);
      setMenuOpen(false);
    } catch {
      /* retry from detail */
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <div className={`relative ${open ? 'z-[120]' : 'z-10'}`}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!open); }}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
        aria-label="More options"
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
              className="absolute bottom-full right-0 z-[130] mb-1 w-44 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-1 shadow-xl sm:bottom-auto sm:top-full sm:mb-0 sm:mt-1"
            >
              {[
                { icon: Pencil, label: 'Quick edit', action: () => { setMenuOpen(false); onEdit(); } },
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
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                >
                  <Icon3D icon={Icon} size={10} className="h-5 w-5" accent={ICON3D_PRESETS.violet} rounded="rounded-md" />
                  {label}
                </button>
              ))}
              {hasPrintAsset(campaign) && (
                <button
                  type="button"
                  onClick={handleDownloadPrint}
                  disabled={downloadBusy}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-3)] disabled:opacity-50"
                >
                  {downloadBusy ? <Loader2 size={14} className="animate-spin" /> : (
                    <Icon3D icon={Download} size={10} className="h-5 w-5" accent={ICON3D_PRESETS.emerald} rounded="rounded-md" />
                  )}
                  Download print card
                </button>
              )}
              <div className="mx-2 my-1 border-t border-[var(--border-color)]" />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
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

const QuickLinkButton = ({ href, label, disabled, title, ariaLabel }) => {
  const className =
    'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-brand-500/50 hover:text-brand-400';
  if (disabled || !href) {
    return (
      <span
        className={`${className} cursor-not-allowed opacity-40`}
        title={title}
      >
        <ExternalLink size={14} />
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={ariaLabel}
      title={label}
    >
      <ExternalLink size={14} />
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
};

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
  const href = getCampaignHref(campaign);
  const isAr = isArMediaType(campaign.campaignType);
  const isDynamic = isDynamicQrType(campaign.campaignType);
  const openUrl = primaryOpenUrl(campaign);
  const hubUrl = hubPublicUrl(campaign);
  const arUrl = arPreviewUrl(campaign);

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
      <Link to={href} className="relative block aspect-video overflow-hidden bg-[var(--surface-3)]">
        <CampaignThumbnail
          campaign={campaign}
          alt={campaign.campaignName}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute left-2.5 top-2.5">
          <StatusBadge status={campaign.status} />
        </div>
        {isAr && campaign.arEffect && campaign.arEffect !== 'none' && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full border border-brand-500/30 bg-black/50 px-2 py-0.5 text-[10px] font-medium text-brand-200 backdrop-blur-sm">
            <Sparkles size={10} />
            {arEffectLabel(campaign.arEffect)}
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Link
              to={href}
              className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text-primary)] hover:text-brand-400"
            >
              {campaign.campaignName}
            </Link>
            <span className="mt-1 inline-block rounded-md border border-[var(--border-color)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
              {campaignTypeLabel(campaign.campaignType)}
            </span>
          </div>
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
            to={`/dashboard/campaigns/${campaign._id}/analytics`}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
          >
            <BarChart3 size={12} /> Analytics
          </Link>
          {isAr && (
            <QuickLinkButton
              href={canPreviewAr(campaign) ? arUrl : null}
              label="AR"
              disabled={!canPreviewAr(campaign)}
              title="Activate to preview AR"
              ariaLabel="Preview AR"
            />
          )}
          {isAr && hubUrl && campaign.redirectSlug && (
            <QuickLinkButton
              href={campaign.status === 'active' ? hubUrl : null}
              label="Hub"
              disabled={campaign.status !== 'active'}
              title="Activate to open link page"
              ariaLabel="Open link page"
            />
          )}
          {!isAr && isDynamic && (
            <QuickLinkButton
              href={campaign.status === 'active' ? openUrl : null}
              label={isHubQrType(campaign.campaignType) ? 'Hub' : campaign.campaignType === 'digital-business-card' ? 'Card' : 'Link'}
              disabled={!openUrl || campaign.status !== 'active'}
              title="Activate to open"
              ariaLabel="Open public page"
            />
          )}
          {!isAr && !isDynamic && (
            <QuickLinkButton
              href={canPreviewAr(campaign) ? arUrl : null}
              label="AR"
              disabled={!canPreviewAr(campaign)}
              title="Activate to preview AR"
              ariaLabel="Preview AR"
            />
          )}
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
