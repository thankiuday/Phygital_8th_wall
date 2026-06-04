import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { billingService } from '../../services/billingService';

/**
 * Pricing CTA: free → register, enterprise → contact, phygital-qr → Stripe Checkout.
 */
const PlanCheckoutButton = ({
  planId,
  billingCycle = 'monthly',
  ctaLabel,
  ctaTo,
  featured = false,
  className = '',
}) => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const baseClass = featured
    ? 'bg-brand-600 text-white shadow-glow hover:bg-brand-500 hover:shadow-glow-lg'
    : 'border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-brand-500/50';

  if (planId === 'free' || planId === 'enterprise') {
    return (
      <Link
        to={ctaTo}
        className={`mt-auto flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${baseClass} ${className}`}
      >
        {ctaLabel}
        <ArrowRight size={14} />
      </Link>
    );
  }

  if (planId !== 'phygital-qr') {
    return (
      <Link
        to={ctaTo || '/register'}
        className={`mt-auto flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] ${baseClass} ${className}`}
      >
        {ctaLabel}
        <ArrowRight size={14} />
      </Link>
    );
  }

  const handleSubscribe = async (e) => {
    e.preventDefault();
    setErr('');

    if (user?.hasFullAccess) {
      setErr('You already have full access via a partner code.');
      return;
    }

    if (user?.hasPhygitalQrAccess && user?.plan === 'phygital_qr') {
      navigate('/dashboard/settings');
      return;
    }

    if (!isAuthenticated) {
      navigate(`/register?plan=phygital-qr&cycle=${billingCycle}`);
      return;
    }

    setLoading(true);
    try {
      const { url } = await billingService.createCheckoutSession({ billingCycle });
      if (url) {
        window.location.href = url;
        return;
      }
      setErr('Checkout could not be started.');
    } catch (error) {
      setErr(error.response?.data?.message || error.message || 'Checkout failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-auto w-full">
      <button
        type="button"
        disabled={loading}
        onClick={handleSubscribe}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-60 ${baseClass} ${className}`}
      >
        {loading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Redirecting…
          </>
        ) : (
          <>
            {ctaLabel}
            <ArrowRight size={14} />
          </>
        )}
      </button>
      {err && (
        <p className="mt-2 text-center text-xs text-red-400" role="alert">
          {err}
        </p>
      )}
    </div>
  );
};

export default PlanCheckoutButton;
