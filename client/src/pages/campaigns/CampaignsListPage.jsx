import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle, Search, QrCode, ScanLine, Calendar,
  MoreVertical, Pencil, Copy, Trash2, Play, Pause,
  BarChart3, ExternalLink, Loader2, AlertCircle,
} from 'lucide-react';
import useCampaignStore from '../../store/useCampaignStore';
import EditCampaignModal from '../../components/ui/EditCampaignModal';

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
const CardMenu = ({ campaign, onEdit, onDuplicate, onToggleStatus, onDelete }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
      >
        <MoreVertical size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-outside trap */}
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] py-1 shadow-xl"
            >
              {[
                { icon: Pencil, label: 'Edit', action: () => { setOpen(false); onEdit(); } },
                { icon: Copy, label: 'Duplicate', action: () => { setOpen(false); onDuplicate(); } },
                {
                  icon: campaign.status === 'active' ? Pause : Play,
                  label: campaign.status === 'active' ? 'Pause' : 'Activate',
                  action: () => { setOpen(false); onToggleStatus(); },
                },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
              <div className="mx-2 my-1 border-t border-[var(--border-color)]" />
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                <Trash2 size={13} />
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
const CampaignCard = ({ campaign, onEdit, onDuplicate, onToggleStatus, onDelete }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    transition={{ duration: 0.25 }}
    className="glass-card group flex flex-col overflow-hidden"
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
          <QrCode size={32} className="text-brand-500/30" />
        </div>
      )}

      {/* Status badge overlay */}
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
        />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
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
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
        >
          <QrCode size={12} /> View
        </Link>
        <Link
          to={`/dashboard/campaigns/${campaign._id}/analytics`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-color)] py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
        >
          <BarChart3 size={12} /> Analytics
        </Link>
        <a
          href={`/ar/${campaign._id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-lg border border-[var(--border-color)] px-2 py-1.5 text-xs text-[var(--text-muted)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          title="Preview AR"
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  </motion.div>
);

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
      <QrCode size={36} className="text-brand-500/40" />
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
        <PlusCircle size={15} /> Create Campaign
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

const CampaignsListPage = () => {
  const navigate = useNavigate();
  const {
    campaigns, pagination, listLoading, listError,
    fetchCampaigns, updateCampaignInList, removeCampaignFromList, duplicateCampaignInList,
  } = useCampaignStore();

  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editTarget, setEditTarget]   = useState(null); // campaign being edited
  const [toastMsg, setToastMsg]       = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Client-side filter + search (data already paged from server)
  const displayed = useMemo(() => {
    let list = campaigns;
    if (statusFilter) list = list.filter((c) => c.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, statusFilter, search]);

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
    if (result.success) {
      showToast('Campaign deleted.');
    } else {
      showToast(result.message);
    }
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

  const handleSaveEdit = async (id, updates) => {
    return updateCampaignInList(id, updates);
  };

  const isFiltered = !!search.trim() || !!statusFilter;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Campaigns</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {pagination ? `${pagination.total} campaign${pagination.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <Link
          to="/dashboard/campaigns/new"
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg"
        >
          <PlusCircle size={15} /> New Campaign
        </Link>
      </div>

      {/* ── Search + filter bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-8.5 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === tab.value
                  ? 'bg-brand-600 text-white shadow-glow'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {listError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle size={16} /> {listError}
        </div>
      )}

      {/* ── Grid ───────────────────────────────────────────────────────── */}
      <motion.div
        layout
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
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

      {/* ── Load more (if paginated) ────────────────────────────────────── */}
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
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] shadow-xl backdrop-blur-sm"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CampaignsListPage;
