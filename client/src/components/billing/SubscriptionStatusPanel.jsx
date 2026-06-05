import { CheckCircle2, Sparkles } from 'lucide-react';
import {
  billingCycleLabel,
  formatBillingDate,
  formatMoneyFromCents,
  formatSubscriptionStatus,
} from '../../utils/subscriptionDisplay';

/**
 * Shows activated Phygital QR state with billing period dates and price.
 */
const SubscriptionStatusPanel = ({ user, billing = null, className = '' }) => {
  const merged = { ...user, ...billing };
  const hasAccess = merged?.hasPhygitalQrAccess || merged?.hasFullAccess;
  const isPaidSubscription =
    merged?.isSubscriptionActive ||
    (merged?.plan === 'phygital_qr' &&
      (merged?.subscriptionStatus === 'active' || merged?.subscriptionStatus === 'trialing'));

  if (!hasAccess) return null;

  if (merged?.hasFullAccess && !isPaidSubscription) {
    return (
      <div
        className={`rounded-xl border border-brand-500/25 bg-brand-500/10 p-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="mt-0.5 shrink-0 text-brand-400" />
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Phygital QR access enabled</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Your account has partner or admin access. You can create Phygital QR campaigns without
              a separate subscription.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cycle = billingCycleLabel(merged?.billingCycle);
  const amount =
    merged?.billingPriceLabel ||
    formatMoneyFromCents(merged?.billingAmountCents, merged?.billingCurrency);
  const statusLabel = formatSubscriptionStatus(merged?.subscriptionStatus);

  return (
    <div
      className={`rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 ${className}`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Phygital QR activated</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              You can create Links + Video and Links, Doc &amp; Video QR campaigns.
            </p>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Status
              </dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                {statusLabel || 'Active'}
              </dd>
            </div>
            {cycle && amount && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                  Plan
                </dt>
                <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                  {cycle} · {amount}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Current period start
              </dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                {formatBillingDate(merged?.currentPeriodStart)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Renews / ends on
              </dt>
              <dd className="mt-0.5 font-medium text-[var(--text-primary)]">
                {formatBillingDate(merged?.currentPeriodEnd)}
              </dd>
            </div>
          </dl>

          {merged?.promotionCodeUsed && (
            <p className="text-xs text-[var(--text-muted)]">
              Promo at checkout:{' '}
              <span className="font-mono text-[var(--text-secondary)]">
                {merged.promotionCodeUsed}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionStatusPanel;
