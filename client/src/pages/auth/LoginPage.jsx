import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Loader2 } from 'lucide-react';
import AuthCard from '../../components/ui/AuthCard';
import BrandWord from '../../components/ui/BrandWord';
import FormInput from '../../components/ui/FormInput';
import useAuthStore from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import { oauthCallbackErrorMessage } from '../../utils/authUiMessages';
import useGuestCampaignDraftStore from '../../store/useGuestCampaignDraftStore';

/* ── Simple client-side validation ──────────────────────────────── */
const validate = ({ email, password }) => {
  const errs = {};
  if (!email) errs.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
  if (!password) errs.password = 'Password is required';
  return errs;
};

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

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();
  const {
    consumeContinuation,
    getDraft,
    getDrafts,
    getContinuation,
    clearContinuation,
    setContinuation,
  } = useGuestCampaignDraftStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [redirectingMessage, setRedirectingMessage] = useState('');
  const redirectTimerRef = useRef(null);

  const from = location.state?.from?.pathname || '/dashboard';
  const continueTo = location.state?.continueTo || '';
  const draftTypeFromState = location.state?.draftType || '';
  const googleAuthUrl = authService.getGoogleAuthUrl();

  useEffect(() => {
    if (location.state?.authMessage) {
      setAuthNotice(location.state.authMessage);
      return;
    }
    const continuation = getContinuation();
    if (continuation?.message) {
      setAuthNotice(continuation.message);
    }
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, [getContinuation, location.state]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthErr = params.get('error');
    if (!oauthErr) return;
    setApiError(oauthCallbackErrorMessage(oauthErr));
    navigate({ pathname: location.pathname, search: '' }, { replace: true, state: location.state });
  }, [location.pathname, location.search, location.state, navigate]);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((p) => ({ ...p, [e.target.name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) return setErrors(errs);

    const result = await login(form.email, form.password);
    if (result.success) {
      const continuation = continueTo
        ? { continueTo, draftType: draftTypeFromState }
        : consumeContinuation();
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
        || continueTo
        || continuation?.continueTo
        || from;
      if (!continueTo) clearContinuation();
      const isDashboard = destination.startsWith('/dashboard');
      setRedirectingMessage(
        isDashboard
          ? 'Logged in successfully. Redirecting you to your dashboard...'
          : 'Logged in successfully. Redirecting you back to your saved draft...'
      );
      redirectTimerRef.current = setTimeout(() => {
        navigate(destination, { replace: true });
      }, 650);
    } else {
      setApiError(result.message);
      if (Array.isArray(result.errors)) {
        const next = {};
        for (const e of result.errors) {
          if (e?.field && typeof e.message === 'string') {
            if (e.field === 'email' || e.field === 'password') {
              next[e.field] = e.message;
            }
          }
        }
        if (Object.keys(next).length) setErrors((p) => ({ ...p, ...next }));
      }
    }
  };

  const handleGoogleSignin = () => {
    if (!continueTo) return;
    setContinuation({
      continueTo,
      draftType: draftTypeFromState || undefined,
      message: authNotice || 'Your work is saved. Login/Register and come back to continue.',
    });
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle={<>Sign in to your <BrandWord /> account</>}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {authNotice && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
          >
            {authNotice}
          </motion.div>
        )}
        {/* API-level error */}
        {apiError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {apiError}
          </motion.div>
        )}

        <FormInput
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@example.com"
          value={form.email}
          onChange={handleChange}
          error={errors.email}
          required
          autoComplete="email"
          autoFocus
        />

        <FormInput
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          required
          autoComplete="current-password"
        />

        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="inline-flex min-h-[44px] items-center text-sm text-brand-400 hover:text-brand-300 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading || !!redirectingMessage}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <LogIn size={16} />
          )}
          {isLoading ? 'Signing in…' : redirectingMessage ? 'Redirecting…' : 'Sign In'}
        </button>
        {redirectingMessage && (
          <p className="text-center text-xs text-emerald-300">{redirectingMessage}</p>
        )}

        <div className="pt-1">
          <p className="mb-2 text-center text-xs text-[var(--text-muted)]">Or continue with</p>
          <a
            href={googleAuthUrl}
            onClick={handleGoogleSignin}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
              G
            </span>
            Sign in with Google
          </a>
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          state={continueTo ? { continueTo, draftType: draftTypeFromState, authMessage: authNotice } : undefined}
          className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
        >
          Create one free
        </Link>
      </p>
    </AuthCard>
  );
};

export default LoginPage;
