import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle, Search, QrCode, Loader2, AlertCircle, X, User,
} from 'lucide-react';
import useCampaignStore from '../../store/useCampaignStore';
import EditCampaignModal from '../../components/ui/EditCampaignModal';
import Icon3D, { ICON3D_PRESETS } from '../../components/ui/Icon3D';
import { CampaignListCard, CampaignListSkeletonCard } from '../../components/campaigns/CampaignListCard';

const EMPTY_COPY = {
  title: 'No digital business cards yet',
  body: 'Create a personalized identity card with your photo, contacts, and social links.',
};

const PersonalizedIdentityPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const {
    campaigns, pagination, listLoading, listError,
    fetchCampaigns, updateCampaignInList, removeCampaignFromList, duplicateCampaignInList,
  } = useCampaignStore();

  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const loadIdentityCards = useCallback((page = 1) => (
    fetchCampaigns({
      campaignType: 'digital-business-card',
      view: 'list',
      limit: 24,
      page,
    })
  ), [fetchCampaigns]);

  useEffect(() => {
    loadIdentityCards(1);
  }, [loadIdentityCards]);

  const displayed = useMemo(() => {
    let list = campaigns;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.campaignName.toLowerCase().includes(q));
    }
    return list;
  }, [campaigns, search]);

  useEffect(() => {
    if (!focusId || !displayed.some((c) => String(c._id) === focusId)) return;
    const t = window.setTimeout(() => {
      document.getElementById(`identity-card-${focusId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [focusId, displayed]);

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
    if (result.success) { showToast('Card removed.'); } else { showToast(result.message); }
  };

  const handleDuplicate = async (campaign) => {
    showToast('Duplicating…');
    const result = await duplicateCampaignInList(campaign._id);
    if (result.success && result.campaign?._id) {
      showToast(`"${result.campaign.campaignName}" created.`);
      navigate(`/dashboard/identity?focus=${result.campaign._id}`, { replace: true });
    } else {
      showToast(result.message || 'Duplicate failed.');
    }
  };

  const handleSaveEdit = async (id, updates) => updateCampaignInList(id, updates);

  const isFiltered = !!search.trim();
  const getHref = (c) => `/dashboard/identity?focus=${c._id}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Icon3D icon={User} size={16} className="h-11 w-11 shrink-0" accent={ICON3D_PRESETS.rose} rounded="rounded-xl" />
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Personalized identity</h1>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">
              {pagination
                ? `${pagination.total} digital business card${pagination.total !== 1 ? 's' : ''}`
                : 'Your shareable digital cards'}
            </p>
          </div>
        </div>
        <Link
          to="/dashboard/campaigns/new/digital-business-card/personalized-identity?new=1"
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg"
        >
          <Icon3D icon={PlusCircle} size={11} className="h-6 w-6" accent={ICON3D_PRESETS.emerald} rounded="rounded-md" />
          Create new business card
        </Link>
      </div>

      <div className="relative flex-1">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-9 pr-12 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition-colors focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {listError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle size={16} /> {listError}
        </div>
      )}

      <motion.div
        layout
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
      >
        {listLoading && !campaigns.length ? (
          Array.from({ length: 8 }).map((_, i) => <CampaignListSkeletonCard key={i} />)
        ) : displayed.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full flex flex-col items-center gap-5 py-20 text-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--surface-2)]">
              <Icon3D icon={QrCode} size={20} className="h-12 w-12" accent={ICON3D_PRESETS.rose} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                {isFiltered ? 'No cards match your search' : EMPTY_COPY.title}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                {isFiltered ? 'Try a different search term.' : EMPTY_COPY.body}
              </p>
            </div>
            {!isFiltered && (
              <Link
                to="/dashboard/campaigns/new/digital-business-card/personalized-identity?new=1"
                className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg"
              >
                <PlusCircle size={15} /> Create new business card
              </Link>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            {displayed.map((campaign) => (
              <CampaignListCard
                key={campaign._id}
                domId={`identity-card-${campaign._id}`}
                cardClassName={
                  focusId && String(campaign._id) === focusId
                    ? 'ring-2 ring-brand-500/50 ring-offset-2 ring-offset-[var(--bg-secondary)]'
                    : ''
                }
                campaign={campaign}
                getCampaignHref={getHref}
                onEdit={() => setEditTarget(campaign)}
                onDuplicate={() => handleDuplicate(campaign)}
                onToggleStatus={() => handleToggleStatus(campaign)}
                onDelete={() => handleDelete(campaign)}
              />
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {pagination && pagination.page < pagination.pages && (
        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => loadIdentityCards(pagination.page + 1)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          >
            {listLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            Load more
          </button>
        </div>
      )}

      {editTarget && (
        <EditCampaignModal
          campaign={editTarget}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

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

export default PersonalizedIdentityPage;
