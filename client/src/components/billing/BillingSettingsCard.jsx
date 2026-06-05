import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { billingService } from '../../services/billingService';

const PLAN_LABELS = {
  free: 'QR (Free)',
  phygital_qr: 'Phygital QR',
  enterprise: 'Phygital Enterprise',
};

const BillingSettingsCard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [err, setErr] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      showToast('Subscription updated. Thank you!');
      searchParams.delete('billing');
      setSearchParams(searchParams, { replace: true });
      refreshUser().catch(() => {});
    }
  }, [searchParams, setSearchParams, refreshUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await billingService.getStatus();
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) setStatus({ billingConfigured: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.plan, user?.subscriptionStatus]);

  const handlePortal = async () => {
    setErr('');
    setPortalLoading(true);
    try {
      const { url } = await billingService.createPortalSession();
      if (url) window.location.href = url;
    } catch (error) {
      setErr(error.response?.data?.message || error.message || 'Could not open billing portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async (billingCycle) => {
    setErr('');
    setCheckoutLoading(true);
    try {
      const { url } = await billingService.createCheckoutSession({ billingCycle });
      if (url) window.location.href = url;
    } catch (error) {
      setErr(error.response?.data?.message || error.message || 'Checkout failed');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const effectivePlan = user?.effectivePlan || user?.plan || 'free';
  const hasPaid = user?.hasPhygitalQrAccess || user?.hasFullAccess;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card space-y-4 p-5 sm:p-6"
    >
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3">
        <CreditCard size={18} className="text-brand-400" />
        <h3 className="font-semibold text-[var(--text-primary)]">Subscription &amp; billing</h3>
      </div>

      {toast && (
        <p className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {toast}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin" />
          Loading billing…
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--text-secondary)]">
            Current plan:{' '}
            <span className="font-semibold text-[var(--text-primary)]">
              {PLAN_LABELS[effectivePlan] || effectivePlan}
            </span>
            {user?.hasFullAccess && (
              <span className="ml-1 text-[var(--text-muted)]">(partner / admin access)</span>
            )}
            {user?.subscriptionStatus && !user?.hasFullAccess && (
              <span className="ml-1 text-[var(--text-muted)]">
                — {user.subscriptionStatus}
              </span>
            )}
          </p>

          {user?.promotionCodeUsed && (
            <p className="text-xs text-[var(--text-muted)]">
              Promo used at checkout: <span className="font-mono">{user.promotionCodeUsed}</span>
            </p>
          )}

          <p className="text-xs text-[var(--text-muted)]">
            Discount codes <span className="font-mono">PHYGITALIZE10</span>–
            <span className="font-mono">100</span> (e.g. <span className="font-mono">99</span>,{' '}
            <span className="font-mono">100</span>) are entered on the Stripe payment page (not in
            Profile coupons).
          </p>

          {!status?.billingConfigured && (
            <p className="text-sm text-amber-400/90">
              Online billing is not configured on this server yet.
            </p>
          )}

          {status?.billingConfigured && !user?.hasFullAccess && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {!hasPaid && (
                <>
                  <button
                    type="button"
                    disabled={checkoutLoading}
                    onClick={() => handleUpgrade('monthly')}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60"
                  >
                    {checkoutLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    Subscribe monthly
                  </button>
                  <button
                    type="button"
                    disabled={checkoutLoading}
                    onClick={() => handleUpgrade('yearly')}
                    className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-brand-500/50 disabled:opacity-60"
                  >
                    Subscribe yearly
                  </button>
                </>
              )}
              {user?.stripeCustomerId && (
                <button
                  type="button"
                  disabled={portalLoading}
                  onClick={handlePortal}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-brand-500/50 disabled:opacity-60"
                >
                  {portalLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ExternalLink size={14} />
                  )}
                  Manage billing
                </button>
              )}
            </div>
          )}

          {err && (
            <p className="text-sm text-red-400" role="alert">
              {err}
            </p>
          )}
        </>
      )}
    </motion.section>
  );
};

export default BillingSettingsCard;
