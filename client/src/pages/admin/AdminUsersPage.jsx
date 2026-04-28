import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, UserCheck, UserX, Shield, ShieldOff,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { adminService } from '../../services/adminService';

// ---------------------------------------------------------------------------
// Role badge + status badge
// ---------------------------------------------------------------------------
const RoleBadge = ({ role }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
    role === 'admin'
      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
      : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
  }`}>
    {role}
  </span>
);

const ActiveBadge = ({ isActive }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
    isActive
      ? 'bg-green-500/15 text-green-400'
      : 'bg-red-500/15 text-red-400'
  }`}>
    {isActive ? 'Active' : 'Suspended'}
  </span>
);

// ---------------------------------------------------------------------------
// Row-level action buttons
// ---------------------------------------------------------------------------
const UserActions = ({ user, onUpdate, currentUserId }) => {
  const [busy, setBusy] = useState(false);

  const act = async (updates) => {
    setBusy(true);
    await onUpdate(user._id, updates);
    setBusy(false);
  };

  const isSelf = user._id === currentUserId;

  return (
    <div className="flex items-center gap-1.5">
      {/* Suspend / Activate */}
      <button
        onClick={() => act({ isActive: !user.isActive })}
        disabled={busy || isSelf}
        aria-label={user.isActive ? 'Suspend user' : 'Activate user'}
        title={user.isActive ? 'Suspend user' : 'Activate user'}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-xs transition-colors disabled:opacity-40 ${
          user.isActive
            ? 'text-red-400 hover:bg-red-500/10'
            : 'text-green-400 hover:bg-green-500/10'
        }`}
      >
        {busy ? <Loader2 size={16} className="animate-spin" />
               : user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
      </button>

      {/* Promote / Demote */}
      <button
        onClick={() => act({ role: user.role === 'admin' ? 'user' : 'admin' })}
        disabled={busy || isSelf}
        aria-label={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
        title={user.role === 'admin' ? 'Remove admin' : 'Make admin'}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-lg text-xs transition-colors disabled:opacity-40 ${
          user.role === 'admin'
            ? 'text-yellow-400 hover:bg-yellow-500/10'
            : 'text-brand-400 hover:bg-brand-500/10'
        }`}
      >
        {user.role === 'admin' ? <ShieldOff size={16} /> : <Shield size={16} />}
      </button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const FILTER_TABS = [
  { value: '',           label: 'All' },
  { value: 'active',     label: 'Active' },
  { value: 'suspended',  label: 'Suspended' },
  { value: 'admin',      label: 'Admins' },
];

const AdminUsersPage = () => {
  const [users, setUsers]           = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]             = useState(1);
  const [toastMsg, setToastMsg]     = useState('');

  // Derive role filter from the tab value
  const roleFilter   = statusFilter === 'admin' ? 'admin' : '';
  const statusParam  = ['active', 'suspended'].includes(statusFilter) ? statusFilter : '';

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await adminService.getUsers({
        search, page: p, limit: 20,
        ...(roleFilter   && { role: roleFilter }),
        ...(statusParam  && { status: statusParam }),
      });
      setUsers(data.users);
      setPagination(data.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusParam]);

  useEffect(() => { setPage(1); load(1); }, [search, statusFilter, load]);

  const handlePage = (p) => { setPage(p); load(p); };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleUpdate = async (id, updates) => {
    try {
      const updated = await adminService.updateUser(id, updates);
      setUsers((prev) => prev.map((u) => (u._id === id ? { ...u, ...updated } : u)));
      showToast('User updated.');
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Users</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {pagination ? `${pagination.total.toLocaleString()} total users` : ''}
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
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-8.5 pr-4 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30"
          />
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
          {FILTER_TABS.map((tab) => (
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
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--surface-2)]" />
          ))
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-8 text-center text-sm text-[var(--text-muted)]">
            No users found.
          </div>
        ) : (
          users.map((u) => (
            <article
              key={u._id}
              className={`glass-card flex flex-col gap-3 p-4 ${!u.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-white">
                  {u.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{u.name}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{u.email}</p>
                </div>
                <UserActions user={u} onUpdate={handleUpdate} currentUserId={null} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border-color)] pt-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--text-muted)]">Role</span>
                  <RoleBadge role={u.role} />
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-[var(--text-muted)]">Status</span>
                  <ActiveBadge isActive={u.isActive} />
                </span>
                <span className="text-[var(--text-muted)]">
                  {u.campaignCount} campaigns · {u.scanCount?.toLocaleString() ?? 0} scans
                </span>
                {u.lastLoginAt && (
                  <span className="text-[var(--text-muted)]">
                    Last login {new Date(u.lastLoginAt).toLocaleDateString()}
                  </span>
                )}
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
                {['User', 'Role', 'Status', 'Campaigns', 'Scans', 'Last Login', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-[var(--surface-3)]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-[var(--text-muted)]">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u._id}
                    className={`transition-colors hover:bg-[var(--surface-2)] ${!u.isActive ? 'opacity-60' : ''}`}
                  >
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                          {u.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{u.name}</p>
                          <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    {/* Status */}
                    <td className="px-4 py-3"><ActiveBadge isActive={u.isActive} /></td>
                    {/* Campaigns */}
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{u.campaignCount}</td>
                    {/* Scans */}
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{u.scanCount?.toLocaleString()}</td>
                    {/* Last login */}
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <UserActions user={u} onUpdate={handleUpdate} currentUserId={null} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination — works for both card and table layouts. Stacks on
          phones so the chevrons drop below the page-of-pages counter. */}
      {pagination && pagination.pages > 1 && (
        <div className="flex flex-col items-stretch gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--text-muted)]">
            Page {pagination.page} of {pagination.pages} &bull; {pagination.total} users
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handlePage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => handlePage(page + 1)}
              disabled={page === pagination.pages}
              aria-label="Next page"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] disabled:opacity-40"
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

export default AdminUsersPage;
