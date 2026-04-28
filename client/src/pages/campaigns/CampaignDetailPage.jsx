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
} from 'lucide-react';
import QRCodeDisplay from '../../components/ui/QRCodeDisplay';
import { campaignService } from '../../services/campaignService';
import EditCampaignModal from '../../components/ui/EditCampaignModal';

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
const ActionMenu = ({ campaign, actionLoading, onEdit, onDuplicate, onToggleStatus, onDelete, onPreviewAR }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400 sm:hidden"
        aria-label="More actions"
      >
        <MoreVertical size={18} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-20 sm:hidden" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-1 shadow-xl sm:hidden"
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
              {campaign.status === 'active' && (
                <a
                  href={`/ar/${campaign._id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                >
                  <ExternalLink size={14} /> Preview AR
                </a>
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
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={32} className="animate-spin text-brand-500" />
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
          {campaign.status === 'active' ? (
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
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            <Trash2 size={14} /> Delete
          </button>
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
