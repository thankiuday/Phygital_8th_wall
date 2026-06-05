import { Link } from 'react-router-dom';
import { CreditCard, Lock } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';

/**
 * Blocks Phygital QR wizards until the user subscribes (or has partner access).
 */
const PhygitalQrSubscribeGate = ({
  children,
  title = 'Subscription required',
  enabled = true,
}) => {
  const user = useAuthStore((s) => s.user);
  const hasAccess = user?.hasPhygitalQrAccess || user?.hasFullAccess;

  if (!enabled || !user || hasAccess) {
    return children;
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 py-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <Lock size={24} className="text-amber-400" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Phygital QR campaigns (Links + Video and Links, Doc &amp; Video) require an active{' '}
          <strong className="font-semibold text-[var(--text-primary)]">Phygital QR</strong>{' '}
          subscription. Subscribe first, then return here to create your campaign.
        </p>
        <p className="text-xs text-[var(--text-muted)]">
          Dynamic QR and digital business cards remain available on the free plan.
        </p>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          to="/pricing"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
        >
          <CreditCard size={16} />
          View plans &amp; subscribe
        </Link>
        <Link
          to="/dashboard/settings"
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--border-color)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-brand-500/50"
        >
          Subscription settings
        </Link>
      </div>
    </div>
  );
};

export default PhygitalQrSubscribeGate;
