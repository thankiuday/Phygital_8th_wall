import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Play, Pause, ExternalLink,
  ChevronLeft, ChevronRight, QrCode, Loader2,
} from 'lucide-react';
import { adminService } from '../../services/adminService';

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
const StatusBadge = ({ status }) => {
  const map = {
    active: 'bg-green-500/15 text-green-400',
    paused: 'bg-yellow-500/15 text-yellow-400',
    draft:  'bg-slate-500/10 text-slate-400',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${map[status] || map.draft}`}>
      {status}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Row-level moderation button
// ---------------------------------------------------------------------------
const ModerationBtn = ({ campaign, onUpdate }) => {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    await onUpdate(campaign._id, { status: campaign.status === 'active' ? 'paused' : 'active' });
    setBusy(false);
  };
  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={campaign.status === 'active' ? 'Pause campaign' : 'Activate campaign'}
      title={campaign.status === 'active' ? 'Pause campaign' : 'Activate campaign'}
      className={`inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
        campaign.status === 'active'
          ? 'text-yellow-400 hover:bg-yellow-500/10'
          : 'text-green-400 hover:bg-green-500/10'
      }`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" />
             : campaign.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
      {campaign.status === 'active' ? 'Pause' : 'Activate'}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const STATUS_TABS = [
  { value: '',        label: 'All' },
  { value: 'active',  label: 'Active' },
  { value: 'paused',  label: 'Paused' },
  { value: 'draft',   label: 'Draft' },
];

const AdminCampaignsPage = () => {
  const [campaigns, setCampaigns]   = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [toastMsg, setToastMsg]     = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await adminService.getCampaigns({
        search, page: p, limit: 20,
        ...(statusFilter && { status: statusFilter }),
      });
      setCampaigns(data.campaigns);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { setPage(1); load(1); }, [search, statusFilter, load]);

  const handlePage = (p) => { setPage(p); load(p); };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleUpdate = async (id, updates) => {
    try {
      const updated = await adminService.updateCampaign(id, updates);
      setCampaigns((prev) => prev.map((c) => (c._id === id ? { ...c, ...updated } : c)));
      showToast('Campaign updated.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Campaigns</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {pagination ? `${pagination.total.toLocaleString()} total campaigns` : ''}
        </p>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search campaign name…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-8.5 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex min-h-[44px] items-center rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
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

      {/* ── Mobile card list (below md:) ─────────────────────────────── */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          ))
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
              <QrCode size={20} className="text-[var(--text-muted)]" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">No campaigns found</h3>
            <p className="max-w-xs text-xs text-[var(--text-muted)]">
              Try a different search term or filter.
            </p>
          </div>
        ) : (
          campaigns.map((c) => (
            <article key={c._id} className="glass-card flex flex-col gap-3 p-4">
              <div className="flex items-start gap-3">
                {c.thumbnailUrl ? (
                  <img src={c.thumbnailUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                    <QrCode size={18} className="text-brand-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{c.campaignName}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {c.userId?.name || '—'} · {c.userId?.email || '—'}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] pt-3 text-xs">
                <span className="text-[var(--text-muted)]">
                  {c.analytics?.totalScans?.toLocaleString() ?? 0} scans
                </span>
                <span className="text-[var(--text-muted)]">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-1">
                  <ModerationBtn campaign={c} onUpdate={handleUpdate} />
                  {c.status === 'active' ? (
                    <a
                      href={`/ar/${c._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Preview AR experience"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-brand-400"
                      title="Preview AR"
                    >
                      <ExternalLink size={16} />
                    </a>
                  ) : (
                    <span
                      className="inline-flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-lg text-[var(--text-muted)] opacity-40"
                      title="Campaign must be active to preview AR"
                    >
                      <ExternalLink size={16} />
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* ── Table (md: and up) ───────────────────────────────────────── */}
      <div className="glass-card hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-muted)]">
                {['Campaign', 'Owner', 'Status', 'Scans', 'Created', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-[var(--surface-3)]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)]">
                        <QrCode size={20} className="text-[var(--text-muted)]" />
                      </div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">No campaigns found</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Try a different search term or filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c._id} className="transition-colors hover:bg-[var(--surface-2)]">
                    {/* Campaign */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.thumbnailUrl ? (
                          <img src={c.thumbnailUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10">
                            <QrCode size={14} className="text-brand-400" />
                          </div>
                        )}
                        <span className="block max-w-[14rem] truncate font-medium text-[var(--text-primary)]">
                          {c.campaignName}
                        </span>
                      </div>
                    </td>
                    {/* Owner */}
                    <td className="px-4 py-3">
                      <p className="block max-w-[14rem] truncate text-xs font-medium text-[var(--text-primary)]">{c.userId?.name || '—'}</p>
                      <p className="block max-w-[14rem] truncate text-xs text-[var(--text-muted)]">{c.userId?.email || '—'}</p>
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    {/* Scans */}
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {c.analytics?.totalScans?.toLocaleString() ?? 0}
                    </td>
                    {/* Created */}
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <ModerationBtn campaign={c} onUpdate={handleUpdate} />
                        {c.status === 'active' ? (
                          <a
                            href={`/ar/${c._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Preview AR experience"
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:text-brand-400"
                            title="Preview AR"
                          >
                            <ExternalLink size={16} />
                          </a>
                        ) : (
                          <span
                            className="inline-flex h-11 w-11 cursor-not-allowed items-center justify-center rounded-lg text-[var(--text-muted)] opacity-40"
                            title="Campaign must be active to preview AR"
                          >
                            <ExternalLink size={16} />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination — works for both card and table layouts */}
      {pagination && pagination.pages > 1 && (
        <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            Page {pagination.page} of {pagination.pages} &bull; {pagination.total} campaigns
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handlePage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] disabled:opacity-40 hover:text-[var(--text-primary)]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => handlePage(page + 1)}
              disabled={page === pagination.pages}
              aria-label="Next page"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] disabled:opacity-40 hover:text-[var(--text-primary)]"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            role="status"
            className="fixed bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] left-1/2 z-50 -translate-x-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] px-5 py-3 text-sm font-medium text-[var(--text-primary)] shadow-xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminCampaignsPage;
