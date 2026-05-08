import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle, Search, QrCode, ScanLine, Calendar,
  MoreVertical, Pencil, Copy, Trash2, Play, Pause,
  BarChart3, ExternalLink, Loader2, AlertCircle, X,
} from 'lucide-react';
import useCampaignStore from '../../store/useCampaignStore';
import EditCampaignModal from '../../components/ui/EditCampaignModal';
import Icon3D, { ICON3D_PRESETS } from '../../components/ui/Icon3D';

const resolveRedirectBase = () => {
  if (import.meta.env.VITE_REDIRECT_BASE) {
    return String(import.meta.env.VITE_REDIRECT_BASE).replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/api\/?$/, '').replace(/\/$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-green-500/15 text-green-400 border-green-500/30',
    paused: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    draft:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Three-dot action menu per card
// ---------------------------------------------------------------------------
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
      >
        {/* Keep kebab icon flat for instant recognizability. */}
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
                  onClick={action}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <Icon3D icon={Icon} size={10} className="h-5 w-5" accent={ICON3D_PRESETS.violet} rounded="rounded-md" />
                  {label}
                </button>
              ))}
              <div className="mx-2 my-1 border-t border-[var(--border-color)]" />
              <button
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

// ---------------------------------------------------------------------------
// Individual campaign card
// ---------------------------------------------------------------------------
const CampaignCard = ({ campaign, onEdit, onDuplicate, onToggleStatus, onDelete }) => {
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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`glass-card group relative flex flex-col overflow-visible ${
        menuOpen ? 'z-[140]' : 'z-10'
      }`}
    >
      {/* Thumbnail */}
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

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/dashboard/campaigns/${campaign._id}`}
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

        {/* Meta row */}
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

        {/* Action buttons */}
        <div className="mt-auto flex gap-2 border-t border-[var(--border-color)] pt-3">
          <Link
            to={`/dashboard/campaigns/${campaign._id}`}
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

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------
const SkeletonCard = () => (
  <div className="glass-card overflow-hidden">
    <div className="aspect-video animate-pulse bg-[var(--surface-3)]" />
    <div className="space-y-3 p-4">
      <div className="h-4 w-3/4 animate-pulse rounded-lg bg-[var(--surface-3)]" />
      <div className="h-3 w-1/2 animate-pulse rounded-lg bg-[var(--surface-3)]" />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
const EmptyState = ({ filtered }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="col-span-full flex flex-col items-center gap-5 py-20 text-center"
  >
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)]">
      <Icon3D icon={QrCode} size={20} className="h-12 w-12" accent={ICON3D_PRESETS.violet} />
    </div>
    <div>
      <h3 className="text-base font-semibold text-[var(--text-primary)]">
        {filtered ? 'No campaigns match your search' : 'No campaigns yet'}
      </h3>
      <p className="mt-1.5 text-sm text-[var(--text-muted)]">
        {filtered
          ? 'Try a different search term or filter.'
          : 'Create your first AR business card campaign to get started.'}
      </p>
    </div>
    {!filtered && (
      <Link
        to="/dashboard/campaigns/new"
        className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg"
      >
        <PlusCircle size={15} /> Phygitalize now
      </Link>
    )}
  </motion.div>
);

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'draft', label: 'Draft' },
];

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'ar-card', label: 'AR Card' },
  { value: 'single-link-qr', label: 'Single Link QR' },
  { value: 'multiple-links-qr', label: 'Multiple Links QR' },
  { value: 'links-video-qr', label: 'Links + Video QR' },
  { value: 'links-doc-video-qr', label: 'Links + Doc + Video QR' },
  { value: 'digital-business-card', label: 'Digital Business Card' },
];

const CampaignsListPage = () => {
  const navigate = useNavigate();
  const {
    campaigns, pagination, listLoading, listError,
    fetchCampaigns, updateCampaignInList, removeCampaignFromList, duplicateCampaignInList,
  } = useCampaignStore();

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter]     = useState('');
  const [editTarget, setEditTarget]     = useState(null);
  const [toastMsg, setToastMsg]         = useState('');

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const displayed = useMemo(() => {
    let list = campaigns;
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (typeFilter) list = list.filter((c) => c.campaignType === typeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, statusFilter, typeFilter, search]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleToggleStatus = async (campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    const result = await updateCampaignInList(campaign._id, { status: newStatus });
    if (!result.success) showToast(result.message);
  };

  const handleDelete = async (campaign) => {
    if (!window.confirm(`Delete "${campaign.campaignName}"? This cannot be undone.`)) return;
    const result = await removeCampaignFromList(campaign._id);
    if (result.success) { showToast('Campaign deleted.'); } else { showToast(result.message); }
  };

  const handleDuplicate = async (campaign) => {
    showToast('Duplicating…');
    const result = await duplicateCampaignInList(campaign._id);
    if (result.success) {
      showToast(`"${result.campaign.campaignName}" created.`);
    } else {
      showToast(result.message);
    }
  };

  const handleSaveEdit = async (id, updates) => updateCampaignInList(id, updates);

  const isFiltered = !!search.trim() || !!statusFilter || !!typeFilter;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Campaigns</h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {pagination ? `${pagination.total} campaign${pagination.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <Link
          to="/dashboard/campaigns/new"
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg"
        >
          <Icon3D icon={PlusCircle} size={11} className="h-6 w-6" accent={ICON3D_PRESETS.emerald} rounded="rounded-md" /> Phygitalize now
        </Link>
      </div>

      {/* ── Search + filter bar ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search — full-width on mobile */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-9 pr-12 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Status filter tabs — horizontally scrollable on mobile */}
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1 scrollbar-hide">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex min-h-[40px] shrink-0 items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === tab.value
                  ? 'bg-brand-600 text-white shadow-glow'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Campaign type filter */}
        <div className="sm:w-[220px]">
          <label htmlFor="campaignTypeFilter" className="sr-only">
            Filter by campaign type
          </label>
          <select
            id="campaignTypeFilter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          >
            {TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {listError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle size={16} /> {listError}
        </div>
      )}

      {/* ── Grid — 1 col mobile, 2 sm, 3 lg, 4 xl ──────────────────── */}
      <motion.div
        layout
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
      >
        {listLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : displayed.length === 0 ? (
          <EmptyState filtered={isFiltered} />
        ) : (
          <AnimatePresence mode="popLayout">
            {displayed.map((campaign) => (
              <CampaignCard
                key={campaign._id}
                campaign={campaign}
                onEdit={() => setEditTarget(campaign)}
                onDuplicate={() => handleDuplicate(campaign)}
                onToggleStatus={() => handleToggleStatus(campaign)}
                onDelete={() => handleDelete(campaign)}
              />
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {/* ── Load more ──────────────────────────────────────────────────── */}
      {pagination && pagination.page < pagination.pages && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => fetchCampaigns({ page: pagination.page + 1 })}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          >
            {listLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            Load more
          </button>
        </div>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────── */}
      {editTarget && (
        <EditCampaignModal
          campaign={editTarget}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            role="status"
            className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] shadow-xl backdrop-blur-sm"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CampaignsListPage;
