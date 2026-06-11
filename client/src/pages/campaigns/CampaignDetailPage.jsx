import { useEffect, useState, useCallback } from 'react';
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
  Sparkles,
} from 'lucide-react';
import QRCodeDisplay from '../../components/ui/QRCodeDisplay';
import DownloadPrintCardButton from '../../components/campaigns/DownloadPrintCardButton';
import { getArMediaProduct } from '../../constants/arMediaProducts';
import { campaignService } from '../../services/campaignService';
import EditCampaignModal from '../../components/ui/EditCampaignModal';
import { getDynamicQrEncodedUrl } from '../../utils/dynamicQrPublicUrl';
import { resolveClientAppBase } from '../../utils/clientAppBase';
import CampaignThumbnail from '../../components/ui/CampaignThumbnail';
import { pickCampaignImageThumbUrl, resolvePlaybackMediaUrl } from '../../utils/assetUrl';
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
  resolveRedirectBase,
} from '../../utils/campaignActions';
import ArExperiencePanel from '../../components/campaigns/ArExperiencePanel';
import SectionCard from '../../components/campaigns/SectionCard';

const DETAIL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'ar', label: 'AR Experience' },
  { id: 'content', label: 'Content & Links' },
];

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
  const isDynamicQr = isDynamicQrType(campaign.campaignType);
  const isHubType = isHubQrType(campaign.campaignType);
  const openDynamicUrl = primaryOpenUrl(campaign);
  const arUrl = arPreviewUrl(campaign);

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
              {hasPrintAsset(campaign) && (
                <DownloadPrintCardButton
                  campaign={campaign}
                  variant="menu"
                  onAfterClick={() => setOpen(false)}
                />
              )}
              {isArMediaType(campaign.campaignType) && canPreviewAr(campaign) && (
                <a
                  href={arUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                >
                  <ExternalLink size={14} /> Preview AR
                </a>
              )}
              {isArMediaType(campaign.campaignType) && hubPublicUrl(campaign) && campaign.redirectSlug && (
                <a
                  href={hubPublicUrl(campaign)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                >
                  <ExternalLink size={14} /> Open link page
                </a>
              )}
              {isDynamicQr && !isArMediaType(campaign.campaignType) && openDynamicUrl && (
                <a
                  href={openDynamicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                >
                  <ExternalLink size={14} />{' '}
                  {isHubType ? 'Open link page' : campaign.campaignType === 'digital-business-card' ? 'Open card' : 'Open Link'}
                </a>
              )}
              {!isDynamicQr && !isArMediaType(campaign.campaignType) && canPreviewAr(campaign) && (
                <a
                  href={arUrl}
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
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (['overview', 'ar', 'content'].includes(hash)) setActiveTab(hash);
  }, [id]);

  const selectTab = useCallback((tabId) => {
    setActiveTab(tabId);
    window.history.replaceState(null, '', `#${tabId}`);
  }, []);

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

  useEffect(() => {
    if (!campaign || campaign.campaignType !== 'digital-business-card') return;
    navigate(
      `/dashboard/campaigns/new/digital-business-card/personalized-identity?edit=${id}`,
      { replace: true },
    );
  }, [campaign, id, navigate]);

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
      navigate(
        campaign.campaignType === 'digital-business-card'
          ? '/dashboard/identity'
          : '/dashboard/campaigns',
        { replace: true },
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    setActionLoading(true);
    try {
      const copy = await campaignService.duplicateCampaign(id);
      if (copy.campaignType === 'digital-business-card') {
        navigate(
          `/dashboard/campaigns/new/digital-business-card/personalized-identity?edit=${copy._id}`,
          { replace: true },
        );
      } else {
        navigate(`/dashboard/campaigns/${copy._id}`);
      }
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

  if (campaign.campaignType === 'digital-business-card') {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" aria-hidden />
        <p className="text-sm text-[var(--text-muted)]">Opening card editor…</p>
      </div>
    );
  }

  const isDynamicQr = isDynamicQrType(campaign.campaignType);
  const isHubType = isHubQrType(campaign.campaignType);
  const isLinksDocVideo = campaign.campaignType === 'links-doc-video-qr';
  const isDigitalCard = campaign.campaignType === 'digital-business-card';
  const openDynamicUrl = primaryOpenUrl(campaign);
  const arUrl = arPreviewUrl(campaign);
  const hubUrl = hubPublicUrl(campaign);
  const isArMedia = isArMediaType(campaign.campaignType);
  const arProduct = isArMedia ? getArMediaProduct(campaign.campaignType) : null;

  const hasContentTab = isDynamicQr && !isArMedia
    || (isArMedia && Array.isArray(campaign.linkItems) && campaign.linkItems.length > 0);

  const visibleTabs = DETAIL_TABS.filter((tab) => {
    if (tab.id === 'ar') return isArMedia;
    if (tab.id === 'content') return hasContentTab;
    return true;
  });
  const currentTab = visibleTabs.some((t) => t.id === activeTab)
    ? activeTab
    : (visibleTabs[0]?.id || 'overview');
  const showContentSections = (!hasContentTab && currentTab === 'overview')
    || (hasContentTab && currentTab === 'content');

  return (
    <div className="mx-auto max-w-4xl min-w-0 max-w-full space-y-4 overflow-x-hidden p-4 sm:space-y-5 sm:p-6">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex min-w-0 w-full flex-wrap items-center gap-2 sm:gap-3">
          <Link
            to="/dashboard/campaigns"
            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-brand-400"
          >
            <ArrowLeft size={15} /> <span className="hidden xs:inline">Campaigns</span>
          </Link>
          <span className="text-[var(--text-muted)]">/</span>
          <span className="max-w-[140px] truncate text-sm font-medium text-[var(--text-primary)] sm:max-w-none">
            {campaign.campaignName}
          </span>
          <StatusBadge status={campaign.status} />

          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <Link
              to={`/dashboard/campaigns/${campaign._id}/analytics`}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
            >
              <BarChart3 size={14} /> Analytics
            </Link>
            {isArMedia && (
              canPreviewAr(campaign) ? (
                <a
                  href={arUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
                >
                  <ExternalLink size={14} /> Preview AR
                </a>
              ) : (
                <span
                  title="Activate this campaign to preview AR."
                  className="flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-muted)] opacity-50"
                >
                  <ExternalLink size={14} /> Preview AR
                </span>
              )
            )}
            {isArMedia && hubUrl && campaign.redirectSlug && (
              <a
                href={hubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
              >
                <ExternalLink size={14} /> Open link page
              </a>
            )}
            {!isArMedia && isDynamicQr && openDynamicUrl && (
              <a
                href={openDynamicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
              >
                <ExternalLink size={14} />{' '}
                {isHubType ? 'Open link page' : isDigitalCard ? 'Open card' : 'Open Link'}
              </a>
            )}
            {!isArMedia && !isDynamicQr && (
              canPreviewAr(campaign) ? (
                <a
                  href={arUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400"
                >
                  <ExternalLink size={14} /> Preview AR
                </a>
              ) : (
                <span className="flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 py-2 text-sm text-[var(--text-muted)] opacity-50">
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
            {hasPrintAsset(campaign) && (
              <DownloadPrintCardButton campaign={campaign} variant="secondary" />
            )}
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:hidden">
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

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[var(--text-primary)] sm:text-xl">{campaign.campaignName}</h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">
              {campaignTypeLabel(campaign.campaignType)}
              {isArMedia && campaign.arEffect && campaign.arEffect !== 'none' && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-brand-500/25 bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-300">
                  <Sparkles size={10} />
                  {campaign.arEffect.replace(/-/g, ' ')}
                </span>
              )}
            </p>
          </div>
        </div>

        {visibleTabs.length > 1 && (
          <nav
            className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1"
            aria-label="Campaign sections"
          >
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => selectTab(tab.id)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                  currentTab === tab.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* ── Tab panels ──────────────────────────────────────────────── */}
      {currentTab === 'overview' && (
      <div className="grid min-w-0 max-w-full gap-4 overflow-x-hidden sm:gap-5 lg:grid-cols-5">
        {/* QR Code — full width on mobile, 2/5 on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card min-w-0 overflow-hidden p-4 sm:p-6 lg:col-span-2"
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
            initialShareUrl={getDynamicQrEncodedUrl({
              campaignType: campaign.campaignType,
              redirectSlug: campaign.redirectSlug,
              ownerHandle: campaign.ownerHandle,
              hubSlug: campaign.hubSlug,
              preciseGeoAnalytics: !!campaign.preciseGeoAnalytics,
              clientBase: resolveClientAppBase(),
              apiRedirectRoot: resolveRedirectBase(),
            })}
          />
        </motion.div>

        {/* Details — full width on mobile, 3/5 on desktop */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-3">
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="grid min-w-0 grid-cols-1 gap-3 xs:grid-cols-2"
          >
            {[
              { icon: ScanLine, label: 'Total Scans', value: campaign.analytics?.totalScans ?? 0, color: 'text-brand-400 bg-brand-500/10' },
              { icon: Calendar, label: 'Created', value: new Date(campaign.createdAt).toLocaleDateString(), color: 'text-accent-400 bg-accent-500/10' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="glass-card min-w-0 p-4">
                <div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
                  <Icon size={16} />
                </div>
                <p className="text-xs text-[var(--text-muted)]">{label}</p>
                <p className="mt-0.5 text-lg font-bold text-[var(--text-primary)] sm:text-xl">{value}</p>
              </div>
            ))}
          </motion.div>

          {isArMedia && (
            <SectionCard
              icon={Sparkles}
              title="AR experience ready"
              description="Manage your print marker, hologram videos, and base effect in the AR Experience tab."
            >
              <div className="flex flex-wrap gap-2">
                {canPreviewAr(campaign) && (
                  <a
                    href={arUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-xs font-medium text-brand-300 hover:bg-brand-500/20 sm:text-sm"
                  >
                    <ExternalLink size={14} /> Preview AR
                  </a>
                )}
                {visibleTabs.some((t) => t.id === 'ar') && (
                  <button
                    type="button"
                    onClick={() => selectTab('ar')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-brand-500/40 hover:text-brand-400 sm:text-sm"
                  >
                    <ImageIcon size={14} /> View print marker & videos
                  </button>
                )}
                {hubUrl && campaign.redirectSlug && (
                  <a
                    href={hubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:border-brand-500/40 hover:text-brand-400 sm:text-sm"
                  >
                    <ExternalLink size={14} /> Open link page
                  </a>
                )}
              </div>
            </SectionCard>
          )}

          {!isArMedia && campaign.targetImageUrl && (
            <SectionCard icon={ImageIcon} title="Campaign image">
              <img
                src={resolvePlaybackMediaUrl(campaign.targetImageUrl)}
                alt="Campaign marker"
                className="mx-auto max-h-64 w-full max-w-sm rounded-xl border border-[var(--border-color)] object-contain bg-[var(--surface-2)]"
              />
            </SectionCard>
          )}
        </div>
      </div>
      )}

      {currentTab === 'ar' && isArMedia && (
        <ArExperiencePanel campaign={campaign} arProduct={arProduct} />
      )}

      {showContentSections && (
      <div className="space-y-4 sm:space-y-5">
          {isArMedia && Array.isArray(campaign.linkItems) && campaign.linkItems.length > 0 && (
            <SectionCard icon={ExternalLink} title="Hub links" description="Quick links shown on your campaign link page when visitors scan the QR.">
              <ul className="space-y-2">
                {campaign.linkItems.map((it) => (
                  <li
                    key={it.linkId}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-primary)]"
                  >
                    <span className="font-medium">{it.label}</span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                      {it.kind} · {it.value}
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
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
                className="block max-w-full truncate rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-brand-400 hover:underline"
                title={campaign.destinationUrl}
              >
                {campaign.destinationUrl}
              </a>
            </motion.div>
          )}

          {showContentSections && isDigitalCard && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card space-y-3 p-4 sm:p-5"
            >
              <div className="flex items-center gap-2">
                <ExternalLink size={16} className="text-brand-400" />
                <h4 className="text-sm font-semibold text-[var(--text-primary)]">Digital Business Card</h4>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Public URL</div>
                  {openDynamicUrl ? (
                    <a
                      href={openDynamicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-sm text-brand-400 hover:underline"
                    >
                      {openDynamicUrl}
                    </a>
                  ) : (
                    <div className="mt-1 text-sm text-[var(--text-muted)]">Not yet allocated</div>
                  )}
                </div>
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Visibility</div>
                  <div className="mt-1 text-sm text-[var(--text-primary)] capitalize">
                    {campaign.visibility || 'public'}
                  </div>
                </div>
              </div>
              {(campaign.cardContent?.fullName || campaign.cardContent?.jobTitle) && (
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text-secondary)]">
                  <div className="font-semibold text-[var(--text-primary)]">{campaign.cardContent?.fullName}</div>
                  <div className="text-xs">{campaign.cardContent?.jobTitle}{campaign.cardContent?.company ? ` · ${campaign.cardContent.company}` : ''}</div>
                </div>
              )}
            </motion.div>
          )}

          {showContentSections && campaign.campaignType === 'multiple-links-qr'
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

          {showContentSections && campaign.campaignType === 'links-video-qr' && (
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
                  src={resolvePlaybackMediaUrl(campaign.videoUrl)}
                  poster={pickCampaignImageThumbUrl(campaign) || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  crossOrigin="anonymous"
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

          {showContentSections && (campaign.campaignType === 'links-video-qr')
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

          {showContentSections && isLinksDocVideo
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
                    <CampaignThumbnail
                      campaign={{
                        thumbnailUrl: vi.thumbnailUrl,
                        videoUrl: vi.source === 'upload' ? vi.url : null,
                      }}
                      alt={vi.label}
                      className="aspect-video w-full object-cover"
                      placeholderClassName="flex aspect-video w-full items-center justify-center bg-[var(--surface-3)] text-[var(--text-muted)]"
                    />
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

          {showContentSections && isLinksDocVideo
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

          {showContentSections && isLinksDocVideo
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
      )}

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
