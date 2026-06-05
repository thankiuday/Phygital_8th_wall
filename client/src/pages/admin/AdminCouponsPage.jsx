import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Loader2, Ticket, Trash2 } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { AdminTableSkeleton } from '../../components/ui/AdminSkeleton';

const ADMIN_QUERY = { staleTime: 60_000, refetchOnWindowFocus: false };

const BENEFIT_LABELS = {
  full_access: 'Full access',
  extra_campaigns: 'Extra campaigns',
  extended_storage: 'Extended storage',
};

const AdminCouponsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    code: '',
    description: '',
    benefit: 'full_access',
    maxUses: 1,
    expiresAt: '',
  });
  const [toastMsg, setToastMsg] = useState('');

  const couponsQ = useQuery({
    queryKey: ['admin', 'coupons', page, search],
    queryFn: () => adminService.getCoupons({ page, limit: 20, search }),
    ...ADMIN_QUERY,
  });

  const coupons = couponsQ.data?.coupons || [];
  const pagination = couponsQ.data?.pagination;

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });

  const createMut = useMutation({
    mutationFn: (payload) => adminService.createCoupon(payload),
    onSuccess: () => {
      invalidate();
      setShowForm(false);
      setForm({ code: '', description: '', benefit: 'full_access', maxUses: 1, expiresAt: '' });
      showToast('Coupon created.');
    },
    onError: (err) => showToast(err.response?.data?.message || 'Create failed.'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }) => adminService.updateCoupon(id, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['admin', 'coupons'] });
      const prev = queryClient.getQueryData(['admin', 'coupons', page, search]);
      if (prev?.coupons) {
        queryClient.setQueryData(['admin', 'coupons', page, search], {
          ...prev,
          coupons: prev.coupons.map((c) => (c._id === id ? { ...c, isActive } : c)),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['admin', 'coupons', page, search], ctx.prev);
      showToast('Update failed.');
    },
    onSettled: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => adminService.deleteCoupon(id),
    onSuccess: () => { invalidate(); showToast('Coupon deleted.'); },
    onError: (err) => showToast(err.response?.data?.message || 'Delete failed.'),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    createMut.mutate({
      code: form.code,
      description: form.description,
      benefit: form.benefit,
      maxUses: Number(form.maxUses) || 1,
      expiresAt: form.expiresAt || null,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Coupons</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Partner codes for 100% free access. Do not use PHYGITALIZE10–100 here — those are Stripe
            subscription discounts at checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus size={16} /> New coupon
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="glass-card grid gap-4 p-5 sm:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Code</label>
              <input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="input-base font-mono uppercase"
                placeholder="PROMO2026"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Max uses</label>
              <input
                type="number"
                min={1}
                value={form.maxUses}
                onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                className="input-base"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="input-base"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Benefit</label>
              <select
                value={form.benefit}
                onChange={(e) => setForm((f) => ({ ...f, benefit: e.target.value }))}
                className="input-base"
              >
                {Object.entries(BENEFIT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--text-muted)]">Expires (optional)</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="input-base"
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={createMut.isPending} className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl px-5 py-2 text-sm text-[var(--text-muted)]">Cancel</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="relative min-w-[200px] max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search codes…"
          className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] py-2.5 pl-8 pr-4 text-sm"
        />
      </div>

      <div className="glass-card overflow-hidden">
        {couponsQ.isLoading ? (
          <AdminTableSkeleton rows={6} cols={6} />
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Ticket size={24} className="text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-muted)]">No coupons yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-left text-xs text-[var(--text-muted)]">
                  {['Code', 'Benefit', 'Uses', 'Expires', 'Active', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {coupons.map((c) => (
                  <tr key={c._id}>
                    <td className="px-4 py-3 font-mono font-semibold">{c.code}</td>
                    <td className="px-4 py-3 text-xs">{BENEFIT_LABELS[c.benefit] || c.benefit}</td>
                    <td className="px-4 py-3 font-mono">{c.usedCount}/{c.maxUses}</td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleMut.mutate({ id: c._id, isActive: !c.isActive })}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.isActive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Off'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete coupon ${c.code}?`)) deleteMut.mutate(c._id);
                        }}
                        className="rounded-lg p-2 text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <p className="text-xs text-[var(--text-muted)]">
          Page {pagination.page} of {pagination.pages}
        </p>
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

export default AdminCouponsPage;
