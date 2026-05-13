import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import useGuestCampaignDraftStore from '../../store/useGuestCampaignDraftStore';

const draftTypeToRoute = {
  'single-link': '/create/dynamic-qr/single-link',
  'multiple-links': '/create/dynamic-qr/multiple-links',
  'links-video': '/create/phygital-qr/links-video',
  'links-doc-video': '/create/phygital-qr/links-doc-video',
};

const resolveLatestDraftRoute = (drafts = {}) => {
  const candidates = Object.values(drafts || {}).filter((d) => d?.sourceRoute && d?.updatedAt);
  if (!candidates.length) return '';
  const latest = candidates.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))[0];
  return latest?.sourceRoute || '';
};

const GoogleAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeGoogleAuth } = useAuthStore();
  const { consumeContinuation, clearContinuation, getDraft, getDrafts } = useGuestCampaignDraftStore();
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const exchangeCode = searchParams.get('code');
      const providerError = searchParams.get('error');
      if (providerError) {
        setError('Google sign-in was cancelled or failed. Please try again.');
        return;
      }
      if (!exchangeCode) {
        setError('Google sign-in could not be completed. Missing callback code.');
        return;
      }
      const result = await completeGoogleAuth(exchangeCode);
      if (result.success) {
        const continuation = consumeContinuation();
        clearContinuation();
        const canonicalFromType = continuation?.draftType
          ? draftTypeToRoute[continuation.draftType]
          : '';
        const routedFromDraft =
          continuation?.draftType
            ? getDraft(continuation.draftType)?.sourceRoute
            : '';
        const latestDraftRoute = resolveLatestDraftRoute(getDrafts());
        const destination =
          latestDraftRoute
          || canonicalFromType
          || routedFromDraft
          || continuation?.continueTo
          || '/dashboard';
        setTimeout(() => {
          navigate(destination, { replace: true });
        }, 450);
      } else {
        setError(result.message || 'Google sign-in failed. Please try again.');
      }
    };
    run();
  }, [clearContinuation, completeGoogleAuth, getDraft, getDrafts, navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-6 text-center shadow-xl">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Google sign-in failed</h1>
            <p className="mt-2 text-sm text-red-400">{error}</p>
            <Link
              to="/login"
              className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              Back to Sign In
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-brand-400">
              <Loader2 size={18} className="animate-spin" />
            </div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Finishing Google sign-in</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Please wait while we securely complete your authentication.
            </p>
            <p className="mt-2 text-xs text-emerald-300">
              You will be redirected to your dashboard or saved draft automatically.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default GoogleAuthCallbackPage;
