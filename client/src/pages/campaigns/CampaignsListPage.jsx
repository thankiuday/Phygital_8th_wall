import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle, Search, QrCode, ScanLine, Calendar,
  Loader2, AlertCircle, X,
} from 'lucide-react';
import useCampaignStore from '../../store/useCampaignStore';
import EditCampaignModal from '../../components/ui/EditCampaignModal';
import Icon3D, { ICON3D_PRESETS } from '../../components/ui/Icon3D';
import { CampaignListCard, CampaignListSkeletonCard } from '../../components/campaigns/CampaignListCard';

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
          Array.from({ length: 8 }).map((_, i) => <CampaignListSkeletonCard key={i} />)
        ) : displayed.length === 0 ? (
          <EmptyState filtered={isFiltered} />
        ) : (
          <AnimatePresence mode="popLayout">
            {displayed.map((campaign) => (
              <CampaignListCard
                key={campaign._id}
                campaign={campaign}
                getCampaignHref={(c) =>
                  c.campaignType === 'digital-business-card'
                    ? `/dashboard/identity?focus=${c._id}`
                    : `/dashboard/campaigns/${c._id}`
                }
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
