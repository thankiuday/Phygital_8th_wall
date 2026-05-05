import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  QrCode,
  ExternalLink,
  Image as ImageIcon,
  Video as VideoIcon,
  ScanLine,
  Calendar,
  Loader2,
  Pause,
  Play,
  Trash2,
  BarChart3,
  Copy,
  Pencil,
  MoreVertical,
  FileText,
  FileSpreadsheet,
  FileImage,
  Presentation,
  FileType,
} from 'lucide-react';
import QRCodeDisplay from '../../components/ui/QRCodeDisplay';
import { campaignService } from '../../services/campaignService';
import EditCampaignModal from '../../components/ui/EditCampaignModal';

const resolveRedirectBase = () => {
  if (import.meta.env.VITE_REDIRECT_BASE) {
    return String(import.meta.env.VITE_REDIRECT_BASE).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};

const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-green-500/15 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    draft: 'bg-surface-500/15 text-[var(--text-muted)] border-[var(--border-color)]',
  };
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${map[status] || map.draft}`}>
      {status}
    </span>
  );
};

/* ── Mobile action sheet (collapsed into three-dot menu on small screens) ── */
const ActionMenu = ({ campaign, actionLoading, onEdit, onDuplicate, onToggleStatus, onDelete }) => {
  const [open, setOpen] = useState(false);
  const isDynamicQr =
    campaign.campaignType === 'single-link-qr'
    || campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const isHubType =
    campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const trackedRedirectUrl = campaign.redirectSlug
    ? `${resolveRedirectBase()}/r/${campaign.redirectSlug}`
    : null;
  const hubPreviewUrl = campaign.redirectSlug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/l/${campaign.redirectSlug}`
    : null;
  const openDynamicUrl = isHubType ? hubPreviewUrl : trackedRedirectUrl;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
        aria-label="More actions"
      >
        <MoreVertical size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-1 shadow-xl"
            >
              <button
                onClick={() => { setOpen(false); onEdit(); }}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                onClick={() => { setOpen(false); onDuplicate(); }}
                disabled={actionLoading}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)] disabled:opacity-50"
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                onClick={() => { setOpen(false); onToggleStatus(); }}
                disabled={actionLoading}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)] disabled:opacity-50"
              >
                {campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                {campaign.status === 'active' ? 'Pause' : 'Activate'}
              </button>
              {isDynamicQr ? (
                openDynamicUrl ? (
                  <a
                    href={openDynamicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                  >
                    <ExternalLink size={14} />{' '}
                    {isHubType ? 'Open link page' : 'Open Link'}
                  </a>
                ) : null
              ) : (
                campaign.status === 'active' && (
                  <a
                    href={`/ar/${campaign._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                  >
                    <ExternalLink size={14} /> Preview AR
                  </a>
                )
              )}
              <div className="mx-2 my-1 border-t border-[var(--border-color)]" />
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                disabled={actionLoading}
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const CampaignDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const c = await campaignService.getCampaign(id);
        setCampaign(c);
      } catch {
        setError('Campaign not found.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggleStatus = async () => {
    setActionLoading(true);
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    try {
      const updated = await campaignService.updateCampaign(id, { status: newStatus });
      setCampaign(updated);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${campaign.campaignName}"? This cannot be undone.`)) return;
    setActionLoading(true);
    try {
      await campaignService.deleteCampaign(id);
      navigate('/dashboard/campaigns', { replace: true });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    setActionLoading(true);
    try {
      const copy = await campaignService.duplicateCampaign(id);
      navigate(`/dashboard/campaigns/${copy._id}`);
    } catch {
      // silent — user stays on the page
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (_id, updates) => {
    try {
      const updated = await campaignService.updateCampaign(id, updates);
      setCampaign(updated);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Save failed' };
    }
  };

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading campaign"
        className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:gap-5 sm:p-6"
      >
        {/* Header bar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="h-6 w-28 animate-pulse rounded-md bg-[var(--surface-2)]" />
          <div className="h-6 w-3 animate-pulse rounded-md bg-[var(--surface-2)] opacity-50" />
          <div className="h-6 w-40 animate-pulse rounded-md bg-[var(--surface-2)]" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-[var(--surface-2)]" />
          <div className="ml-auto hidden gap-2 sm:flex">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-9 w-24 animate-pulse rounded-xl bg-[var(--surface-2)]" />
            ))}
          </div>
          <div className="ml-auto flex gap-1.5 sm:hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-11 w-11 animate-pulse rounded-xl bg-[var(--surface-2)]" />
            ))}
          </div>
        </div>

        {/* Content grid */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
          <div className="glass-card lg:col-span-2">
            <div className="aspect-square animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
            </div>
            <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
            <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          </div>
        </div>

        <span className="sr-only">
          Loading campaign details… <Loader2 className="hidden" />
        </span>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-[var(--text-secondary)]">{error || 'Campaign not found.'}</p>
        <Link to="/dashboard/campaigns" className="text-sm text-brand-400 hover:underline">← Back to campaigns</Link>
      </div>
    );
  }

  const isDynamicQr =
    campaign.campaignType === 'single-link-qr'
    || campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const isHubType =
    campaign.campaignType === 'multiple-links-qr'
    || campaign.campaignType === 'links-video-qr'
    || campaign.campaignType === 'links-doc-video-qr';
  const isLinksDocVideo = campaign.campaignType === 'links-doc-video-qr';
  const trackedRedirectUrl = campaign.redirectSlug
    ? `${resolveRedirectBase()}/r/${campaign.redirectSlug}`
    : null;
  const hubPreviewUrl = campaign.redirectSlug
    ? `${window.location.origin}/l/${campaign.redirectSlug}`
    : null;
  const openDynamicUrl = isHubType ? hubPreviewUrl : trackedRedirectUrl;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:space-y-5 sm:p-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Breadcrumb */}
        <Link
          to="/dashboard/campaigns"
          className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-brand-400"
        >
          <ArrowLeft size={15} /> <span className="hidden xs:inline">Campaigns</span>
        </Link>
        <span className="text-[var(--text-muted)]">/</span>
        <span className="max-w-[120px] truncate text-sm font-medium text-[var(--text-primary)] sm:max-w-none">
          {campaign.campaignName}
        </span>
        <StatusBadge status={campaign.status} />

        {/* ── Desktop action bar ─────────────────────────────────── */}
        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <Link
            to={`/dashboard/campaigns/${campaign._id}/analytics`}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
          >
            <BarChart3 size={14} /> Analytics
          </Link>
          {isDynamicQr ? (
            openDynamicUrl ? (
              <a
                href={openDynamicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
              >
                <ExternalLink size={14} />{' '}
                {isHubType ? 'Open link page' : 'Open Link'}
              </a>
            ) : null
          ) : (
            campaign.status === 'active' ? (
              <a
                href={`/ar/${campaign._id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
              >
                <ExternalLink size={14} /> Preview AR
              </a>
            ) : (
              <span
                title="Activate this campaign to open the public AR page."
                className="flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-muted)] opacity-50"
              >
                <ExternalLink size={14} /> Preview AR
              </span>
            )
          )}
          <button
            onClick={() => setShowEdit(true)}
            disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 disabled:opacity-50"
          >
            <Pencil size={14} /> Edit
          </button>
          <button
            onClick={handleDuplicate}
            disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 disabled:opacity-50"
          >
            <Copy size={14} /> Duplicate
          </button>
          <button
            onClick={toggleStatus}
            disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 disabled:opacity-50"
          >
            {campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
            {campaign.status === 'active' ? 'Pause' : 'Activate'}
          </button>
          <ActionMenu
            campaign={campaign}
            actionLoading={actionLoading}
            onEdit={() => setShowEdit(true)}
            onDuplicate={handleDuplicate}
            onToggleStatus={toggleStatus}
            onDelete={handleDelete}
          />
        </div>

        {/* ── Mobile: condensed icon actions + three-dot overflow ── */}
        <div className="ml-auto flex items-center gap-1.5 sm:hidden">
          <Link
            to={`/dashboard/campaigns/${campaign._id}/analytics`}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
            aria-label="View analytics"
            title="Analytics"
          >
            <BarChart3 size={18} />
          </Link>
          <button
            onClick={toggleStatus}
            disabled={actionLoading}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-brand-500/50 disabled:opacity-50"
            aria-label={campaign.status === 'active' ? 'Pause campaign' : 'Activate campaign'}
            title={campaign.status === 'active' ? 'Pause' : 'Activate'}
          >
            {campaign.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <ActionMenu
            campaign={campaign}
            actionLoading={actionLoading}
            onEdit={() => setShowEdit(true)}
            onDuplicate={handleDuplicate}
            onToggleStatus={toggleStatus}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* ── Content grid ────────────────────────────────────────────── */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-5">
        {/* QR Code — full width on mobile, 2/5 on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-5 sm:p-6 lg:col-span-2"
        >
          <div className="mb-4 flex items-center gap-2">
            <QrCode size={18} className="text-brand-400" />
            <h3 className="font-semibold text-[var(--text-primary)]">QR Code</h3>
          </div>
          <QRCodeDisplay
            campaignId={campaign._id}
            campaignName={campaign.campaignName}
            initialQrUrl={campaign.qrCodeUrl}
            campaignActive={campaign.status === 'active'}
            campaignType={campaign.campaignType}
            redirectSlug={campaign.redirectSlug}
          />
        </motion.div>

        {/* Details — full width on mobile, 3/5 on desktop */}
        <div className="flex flex-col gap-4 lg:col-span-3">
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-2 gap-3"
          >
            {[
              { icon: ScanLine, label: 'Total Scans', value: campaign.analytics?.totalScans ?? 0, color: 'text-brand-400 bg-brand-500/10' },
              { icon: Calendar, label: 'Created', value: new Date(campaign.createdAt).toLocaleDateString(), color: 'text-accent-400 bg-accent-500/10' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="glass-card p-4">
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                  <Icon size={16} />
                </div>
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="mt-0.5 text-lg font-bold text-[var(--text-primary)] sm:text-xl">{value}</p>
              </div>
            ))}
          </motion.div>

          {/* Card image preview */}
          {campaign.targetImageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <ImageIcon size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Business Card Image</h4>
                <span className="ml-auto text-xs text-[var(--text-muted)]">AR Marker</span>
              </div>
              <img
                src={campaign.targetImageUrl}
                alt="Business card"
                className="max-h-48 w-full rounded-xl border border-[var(--border-color)] object-contain"
              />
            </motion.div>
          )}

          {/* Video preview */}
          {campaign.videoUrl && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <VideoIcon size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Intro Video</h4>
                <span className="ml-auto text-xs text-[var(--text-muted)]">AR Hologram</span>
              </div>
              <video
                src={campaign.videoUrl}
                controls
                playsInline
                className="max-h-64 w-full rounded-xl border border-[var(--border-color)] object-contain"
              />
            </motion.div>
          )}

          {campaign.campaignType === 'single-link-qr' && campaign.destinationUrl && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Destination Link</h4>
              </div>
              <a
                href={campaign.destinationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-brand-400 hover:underline"
                title={campaign.destinationUrl}
              >
                {campaign.destinationUrl}
              </a>
            </motion.div>
          )}

          {campaign.campaignType === 'multiple-links-qr'
            && Array.isArray(campaign.linkItems)
            && campaign.linkItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Hub links</h4>
              </div>
              <ul className="space-y-2">
                {campaign.linkItems.map((it) => (
                  <li
                    key={it.linkId}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span className="font-medium">{it.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {it.kind} · {it.value}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {campaign.campaignType === 'links-video-qr' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <VideoIcon size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Hero video</h4>
              </div>
              {campaign.videoSource === 'upload' && campaign.videoUrl ? (
                <video
                  src={campaign.videoUrl}
                  poster={campaign.thumbnailUrl || undefined}
                  controls
                  playsInline
                  className="max-h-64 w-full rounded-xl border border-[var(--border-color)] object-contain"
                />
              ) : campaign.externalVideoUrl ? (
                <a
                  href={campaign.externalVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-brand-400 hover:underline"
                >
                  <ExternalLink size={14} />
                  Watch external video
                </a>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">No video configured.</p>
              )}
            </motion.div>
          )}

          {(campaign.campaignType === 'links-video-qr')
            && Array.isArray(campaign.linkItems)
            && campaign.linkItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Hub links</h4>
              </div>
              <ul className="space-y-2">
                {campaign.linkItems.map((it) => (
                  <li
                    key={it.linkId}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span className="font-medium">{it.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {it.kind} · {it.value}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {isLinksDocVideo
            && Array.isArray(campaign.videoItems)
            && campaign.videoItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <VideoIcon size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  Videos ({campaign.videoItems.length})
                </h4>
              </div>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {campaign.videoItems.map((vi) => (
                  <li
                    key={vi.videoId}
                    className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]"
                  >
                    {vi.thumbnailUrl ? (
                      <img
                        src={vi.thumbnailUrl}
                        alt=""
                        aria-hidden="true"
                        className="aspect-video w-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-[var(--surface-3)] text-[var(--text-muted)]">
                        <VideoIcon size={28} />
                      </div>
                    )}
                    <div className="space-y-1 p-3">
                      <p className="truncate text-sm font-medium text-[var(--text-primary)]">
                        {vi.label}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {vi.source === 'upload' ? 'Uploaded video' : 'External link'}
                      </p>
                      {(vi.url || vi.externalVideoUrl) && (
                        <a
                          href={vi.url || vi.externalVideoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                        >
                          Open <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {isLinksDocVideo
            && Array.isArray(campaign.docItems)
            && campaign.docItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <FileText size={16} className="text-amber-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                  Documents ({campaign.docItems.length})
                </h4>
              </div>
              <ul className="space-y-2">
                {campaign.docItems.map((di) => {
                  const Icon = (() => {
                    const m = di.mimeType || '';
                    if (m === 'application/pdf') return FileText;
                    if (m.startsWith('image/')) return FileImage;
                    if (m.includes('spreadsheet') || m.includes('excel')) return FileSpreadsheet;
                    if (m.includes('presentation') || m.includes('powerpoint')) return Presentation;
                    if (m.includes('word')) return FileType;
                    return FileText;
                  })();
                  const formatBytes = (bytes) => {
                    if (!bytes || bytes < 1024) return `${bytes || 0} B`;
                    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
                    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                  };
                  return (
                    <li
                      key={di.docId}
                      className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2.5 text-sm"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-[var(--text-primary)]">{di.label}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {(di.mimeType || 'document')} · {formatBytes(di.bytes)}
                        </p>
                      </div>
                      {di.url && (
                        <a
                          href={di.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-400 hover:underline"
                        >
                          Open <ExternalLink size={11} />
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}

          {isLinksDocVideo
            && Array.isArray(campaign.linkItems)
            && campaign.linkItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="glass-card p-4 sm:p-5"
            >
              <div className="mb-3 flex items-center gap-2">
                <ExternalLink size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Hub links</h4>
              </div>
              <ul className="space-y-2">
                {campaign.linkItems.map((it) => (
                  <li
                    key={it.linkId}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  >
                    <span className="font-medium">{it.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {it.kind} · {it.value}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditCampaignModal
          campaign={campaign}
          onSave={handleSaveEdit}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
};

export default CampaignDetailPage;
