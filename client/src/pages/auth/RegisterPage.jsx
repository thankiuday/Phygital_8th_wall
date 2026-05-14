import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import AuthCard from '../../components/ui/AuthCard';
import FormInput from '../../components/ui/FormInput';
import useAuthStore from '../../store/useAuthStore';
import { authService } from '../../services/authService';
import { oauthCallbackErrorMessage } from '../../utils/authUiMessages';
import useGuestCampaignDraftStore from '../../store/useGuestCampaignDraftStore';

/* ── Password strength meter ─────────────────────────────────────── */
const getStrength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const score = getStrength(password);
  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= score ? STRENGTH_COLORS[score] : 'bg-[var(--surface-3)]'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-[var(--text-muted)]">
        Strength: {STRENGTH_LABELS[score]}
      </span>
    </div>
  );
};

/* ── Password requirement check rows ─────────────────────────────── */
const Req = ({ met, label }) => (
  <li className="flex items-center gap-1.5 text-xs">
    {met ? (
      <CheckCircle2 size={12} className="text-green-400" />
    ) : (
      <XCircle size={12} className="text-[var(--text-muted)]" />
    )}
    <span className={met ? 'text-green-400' : 'text-[var(--text-muted)]'}>{label}</span>
  </li>
);

/* ── Client-side validation ──────────────────────────────────────── */
const validate = ({ email, password, confirmPassword, agreedToCertification }) => {
  const errs = {};
  if (!email) errs.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
  if (!password) errs.password = 'Password is required';
  else if (password.length < 8) errs.password = 'Minimum 8 characters';
  else if (!/[A-Z]/.test(password)) errs.password = 'Must contain an uppercase letter';
  else if (!/[0-9]/.test(password)) errs.password = 'Must contain a number';
  if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
  else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
  if (!agreedToCertification) {
    errs.agreedToCertification = 'You must accept the certification and agreement to create an account';
  }
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

const RegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { register: registerUser, isLoading } = useAuthStore();
  const { consumeContinuation, clearContinuation, getDraft, getDrafts, setContinuation } = useGuestCampaignDraftStore();
  const googleAuthUrl = authService.getGoogleAuthUrl();
  const continueTo = location.state?.continueTo || '';
  const authNotice = location.state?.authMessage || '';
  const draftTypeFromState = location.state?.draftType || '';

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    agreedToCertification: false,
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [redirectingMessage, setRedirectingMessage] = useState('');
  const redirectTimerRef = useRef(null);

  const handleChange = (e) => {
    const nextValue = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [e.target.name]: nextValue }));
    if (errors[e.target.name]) setErrors((p) => ({ ...p, [e.target.name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) return setErrors(errs);

    const result = await registerUser(form.email, form.password, form.agreedToCertification);
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
        || '/dashboard';
      if (!continueTo) clearContinuation();
      const isDashboard = destination.startsWith('/dashboard');
      setRedirectingMessage(
        isDashboard
          ? 'Account created. Redirecting you to your dashboard...'
          : 'Account created. Redirecting you back to your saved draft...'
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
            if (e.field === 'email' || e.field === 'password' || e.field === 'agreedToCertification') {
              next[e.field] = e.message;
            }
          }
        }
        if (Object.keys(next).length) setErrors((p) => ({ ...p, ...next }));
      }
    }
  };

  useEffect(
    () => () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthErr = params.get('error');
    if (!oauthErr) return;
    setApiError(oauthCallbackErrorMessage(oauthErr));
    navigate({ pathname: location.pathname, search: '' }, { replace: true, state: location.state });
  }, [location.pathname, location.search, location.state, navigate]);

  const handleGoogleSignup = (e) => {
    if (form.agreedToCertification) return;
    e.preventDefault();
    setErrors((prev) => ({
      ...prev,
      agreedToCertification: 'You must accept the certification and agreement to create an account',
    }));
  };

  const handleGoogleRegisterRedirect = () => {
    if (!continueTo) return;
    setContinuation({
      continueTo,
      draftType: draftTypeFromState || undefined,
      message: authNotice || 'Your work is saved. Login/Register and come back to continue.',
    });
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building your AR business card campaigns"
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
        <AnimatePresence>
          {apiError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
            >
              {apiError}
            </motion.div>
          )}
        </AnimatePresence>

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

        <div>
          <FormInput
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            value={form.password}
            onChange={handleChange}
            error={errors.password}
            required
            autoComplete="new-password"
          />
          <PasswordStrength password={form.password} />
          {form.password && (
            <ul className="mt-2 space-y-0.5">
              <Req met={form.password.length >= 8} label="At least 8 characters" />
              <Req met={/[A-Z]/.test(form.password)} label="One uppercase letter" />
              <Req met={/[0-9]/.test(form.password)} label="One number" />
            </ul>
          )}
        </div>

        <FormInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          placeholder="Re-enter your password"
          value={form.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <div className="space-y-2">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--text-secondary)]">
            <input
              type="checkbox"
              id="agreedToCertification"
              name="agreedToCertification"
              checked={form.agreedToCertification}
              onChange={handleChange}
              className="mt-0.5 h-4 w-4 rounded border-[var(--border-color)]"
              required
            />
            <span>
              I certify and agree to all of the following (required to create an account):{' '}
              <Link to="/user-certification-agreement" className="font-medium text-brand-400 hover:underline">
                View Certification &amp; Agreement
              </Link>
            </span>
          </label>
          {errors.agreedToCertification && (
            <p className="text-xs text-red-400">{errors.agreedToCertification}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading || !!redirectingMessage}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <UserPlus size={16} />
          )}
          {isLoading ? 'Creating account…' : redirectingMessage ? 'Redirecting…' : 'Create Account'}
        </button>
        {redirectingMessage && (
          <p className="text-center text-xs text-emerald-300">{redirectingMessage}</p>
        )}

        <div className="pt-1">
          <p className="mb-2 text-center text-xs text-[var(--text-muted)]">Or continue with</p>
          <a
            href={googleAuthUrl}
            onClick={(e) => {
              handleGoogleSignup(e);
              if (!e.defaultPrevented) {
                handleGoogleRegisterRedirect();
              }
            }}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
              G
            </span>
            Sign up with Google
          </a>
        </div>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
        Already have an account?{' '}
        <Link
          to="/login"
          state={continueTo ? { continueTo, draftType: draftTypeFromState, authMessage: authNotice } : undefined}
          className="font-medium text-brand-400 hover:text-brand-300 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default RegisterPage;
