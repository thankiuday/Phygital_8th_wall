import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, UserCheck, UserX, Shield, ShieldOff, Trash2, KeyRound,
  ChevronLeft, ChevronRight, Loader2, Users, X, Eye,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import useAuthStore from '../../store/useAuthStore';
import { AdminTableSkeleton } from '../../components/ui/AdminSkeleton';

const ADMIN_QUERY = { staleTime: 60_000, refetchOnWindowFocus: false };

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
    isActive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
  }`}>
    {isActive ? 'Active' : 'Suspended'}
  </span>
);

const FILTER_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'admin', label: 'Admins' },
];

const UserDetailDrawer = ({ userId, onClose }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminService.getUserDetail(userId),
    enabled: !!userId,
    ...ADMIN_QUERY,
  });

  if (!userId) return null;

  const user = data?.user;
  const pm = data?.passwordMeta;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[var(--border-color)] bg-[var(--surface-1)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">User detail</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && <p className="text-sm text-[var(--text-muted)]">Loading…</p>}
          {error && <p className="text-sm text-red-400">{error.message}</p>}
          {user && (
            <div className="space-y-6">
              <div>
                <p className="text-lg font-semibold">{user.name}</p>
                <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
                <div className="mt-2 flex gap-2">
                  <RoleBadge role={user.role} />
                  <ActiveBadge isActive={user.isActive} />
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-color)] p-4 text-sm">
                <p className="text-xs text-[var(--text-muted)]">Auth</p>
                <p className="mt-1 capitalize">{pm?.provider || 'local'}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {pm?.provider === 'google' ? 'Google OAuth' : 'Has password (reset via admin)'}
                </p>
                {user.hasFullAccess && (
                  <p className="mt-2 text-xs text-green-400">
                    Full access · {user.couponRedeemed}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-muted)]">Campaigns ({data.campaigns?.length || 0})</p>
                <ul className="mt-2 space-y-2">
                  {(data.campaigns || []).slice(0, 10).map((c) => (
                    <li key={c._id} className="text-sm">
                      <span className="font-medium">{c.campaignName}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">{c.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Total scans: {data.totalScans?.toLocaleString() ?? 0}
              </p>
            </div>
          )}
        </div>
      </motion.aside>
    </div>
  );
};

const ResetPasswordModal = ({ user, onClose, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await adminService.resetUserPassword(user._id, password);
      onSuccess('Password reset.');
      onClose();
    } catch (ex) {
      setErr(ex.response?.data?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <form onSubmit={submit} className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 shadow-xl">
        <h3 className="text-lg font-semibold">Reset password</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{user.email}</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (8+ chars, upper + number)"
          className="mt-4 w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2.5 text-sm"
          required
          minLength={8}
        />
        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--text-muted)]">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={16} className="animate-spin" /> : 'Reset'}
          </button>
        </div>
      </form>
    </div>
  );
};

const AdminUsersPage = () => {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?._id);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [drawerId, setDrawerId] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toastMsg, setToastMsg] = useState('');

  const roleFilter = statusFilter === 'admin' ? 'admin' : '';
  const statusParam = ['active', 'suspended'].includes(statusFilter) ? statusFilter : '';

  const usersQ = useQuery({
    queryKey: ['admin', 'users', page, search, roleFilter, statusParam],
    queryFn: () => adminService.getUsers({
      search, page, limit: 20,
      ...(roleFilter && { role: roleFilter }),
      ...(statusParam && { status: statusParam }),
    }),
    ...ADMIN_QUERY,
  });

  const users = usersQ.data?.users || [];
  const pagination = usersQ.data?.pagination;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });

  const updateMut = useMutation({
    mutationFn: ({ id, updates }) => adminService.updateUser(id, updates),
    onSuccess: () => { invalidate(); showToast('User updated.'); },
    onError: (err) => showToast(err.response?.data?.message || 'Update failed.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id) => adminService.deleteUser(id),
    onSuccess: () => {
      invalidate();
      setDeleteConfirm(null);
      showToast('User deleted.');
    },
    onError: (err) => showToast(err.response?.data?.message || 'Delete failed.'),
  });

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkUpdate = async (updates) => {
    const ids = [...selected].filter((id) => id !== currentUserId);
    const results = await Promise.allSettled(
      ids.map((id) => adminService.updateUser(id, updates))
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    showToast(`${ok}/${ids.length} users updated.`);
    setSelected(new Set());
    invalidate();
  };

  const handleUpdate = (id, updates) => {
    if (id === currentUserId && (updates.isActive === false || updates.role === 'user')) {
      showToast('Cannot suspend or demote yourself.');
      return;
    }
    updateMut.mutate({ id, updates });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Users</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {pagination ? `${pagination.total.toLocaleString()} total users` : ''}
          </p>
        </div>
        {selected.size > 0 && (
          <div className="flex gap-2">
            <button type="button" onClick={() => bulkUpdate({ isActive: true })} className="rounded-lg border border-green-500/30 px-3 py-1.5 text-xs text-green-400">Activate ({selected.size})</button>
            <button type="button" onClick={() => bulkUpdate({ isActive: false })} className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400">Suspend ({selected.size})</button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name or email…"
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-8 pr-4 text-sm text-[var(--text-primary)] outline-none focus:border-brand-500"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] p-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                statusFilter === tab.value ? 'bg-brand-600 text-white' : 'text-[var(--text-muted)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card hidden overflow-hidden md:block">
        {usersQ.isLoading ? (
          <AdminTableSkeleton rows={8} cols={8} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-muted)]">
                  <th className="px-3 py-3 w-8" />
                  {['User', 'Auth', 'Role', 'Status', 'Campaigns', 'Scans', 'Last login', 'Actions'].map((h) => (
                    <th key={h} className="px-3 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {users.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-[var(--text-muted)]">No users found</td></tr>
                ) : users.map((u) => {
                  const isSelf = u._id === currentUserId;
                  return (
                    <tr key={u._id} className={!u.isActive ? 'opacity-60' : ''}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(u._id)}
                          disabled={isSelf}
                          onChange={() => toggleSelect(u._id)}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                      </td>
                      <td className="px-3 py-3 text-xs capitalize text-[var(--text-muted)]">
                        {u.authProvider === 'google' ? 'Google OAuth' : 'Password'}
                      </td>
                      <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                      <td className="px-3 py-3"><ActiveBadge isActive={u.isActive} /></td>
                      <td className="px-3 py-3">{u.campaignCount}</td>
                      <td className="px-3 py-3">{u.scanCount?.toLocaleString()}</td>
                      <td className="px-3 py-3 text-xs text-[var(--text-muted)]">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button type="button" title="View" onClick={() => setDrawerId(u._id)} className="rounded-lg p-2 text-[var(--text-muted)] hover:text-brand-400">
                            <Eye size={16} />
                          </button>
                          <button type="button" title="Reset password" onClick={() => setResetUser(u)} disabled={isSelf} className="rounded-lg p-2 text-[var(--text-muted)] hover:text-brand-400 disabled:opacity-40">
                            <KeyRound size={16} />
                          </button>
                          <button type="button" onClick={() => handleUpdate(u._id, { isActive: !u.isActive })} disabled={isSelf} className="rounded-lg p-2 text-[var(--text-muted)] hover:text-red-400 disabled:opacity-40">
                            {u.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                          </button>
                          <button type="button" onClick={() => handleUpdate(u._id, { role: u.role === 'admin' ? 'user' : 'admin' })} disabled={isSelf} className="rounded-lg p-2 disabled:opacity-40">
                            {u.role === 'admin' ? <ShieldOff size={16} className="text-yellow-400" /> : <Shield size={16} className="text-brand-400" />}
                          </button>
                          <button type="button" onClick={() => setDeleteConfirm(u)} disabled={isSelf} className="rounded-lg p-2 text-[var(--text-muted)] hover:text-red-400 disabled:opacity-40">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-3 md:hidden">
        {usersQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-[var(--surface-2)]" />)
        ) : users.map((u) => (
          <article key={u._id} className="glass-card p-4">
            <p className="font-semibold">{u.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <RoleBadge role={u.role} />
              <ActiveBadge isActive={u.isActive} />
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setDrawerId(u._id)} className="text-xs text-brand-400">Details</button>
              <button type="button" onClick={() => setResetUser(u)} className="text-xs text-brand-400">Reset pwd</button>
            </div>
          </article>
        ))}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] px-4 py-3">
          <p className="text-xs text-[var(--text-muted)]">Page {pagination.page} of {pagination.pages}</p>
          <div className="flex gap-2">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={18} /></button>
            <button type="button" disabled={page === pagination.pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={18} /></button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {drawerId && <UserDetailDrawer userId={drawerId} onClose={() => setDrawerId(null)} />}
      </AnimatePresence>

      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} onSuccess={showToast} />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
          <div className="relative z-10 max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6">
            <h3 className="text-lg font-semibold text-red-400">Delete user</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Type <strong>{deleteConfirm.email}</strong> to confirm permanent deletion.
            </p>
            <input
              id="delete-email-confirm"
              type="text"
              placeholder={deleteConfirm.email}
              className="mt-4 w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2 text-sm"
              onChange={(e) => {
                e.target.dataset.confirmed = e.target.value === deleteConfirm.email ? '1' : '';
              }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="rounded-lg px-4 py-2 text-sm">Cancel</button>
              <button
                type="button"
                disabled={deleteMut.isPending}
                onClick={(e) => {
                  const input = document.getElementById('delete-email-confirm');
                  if (input?.value !== deleteConfirm.email) {
                    showToast('Email does not match.');
                    return;
                  }
                  deleteMut.mutate(deleteConfirm._id);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border bg-[var(--surface-1)] px-5 py-3 text-sm shadow-xl"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsersPage;
