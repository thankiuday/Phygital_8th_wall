import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import AuthCard from '../../components/ui/AuthCard';
import FormInput from '../../components/ui/FormInput';
import useAuthStore from '../../store/useAuthStore';

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
const validate = ({ name, email, password, confirmPassword }) => {
  const errs = {};
  if (!name || name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
  if (!email) errs.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
  if (!password) errs.password = 'Password is required';
  else if (password.length < 8) errs.password = 'Minimum 8 characters';
  else if (!/[A-Z]/.test(password)) errs.password = 'Must contain an uppercase letter';
  else if (!/[0-9]/.test(password)) errs.password = 'Must contain a number';
  if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
  else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
  return errs;
};

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser, isLoading } = useAuthStore();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((p) => ({ ...p, [e.target.name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) return setErrors(errs);

    const result = await registerUser(form.name.trim(), form.email, form.password);
    if (result.success) {
      navigate('/dashboard', { replace: true });
    } else {
      setApiError(result.message);
    }
  };

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start building your AR business card campaigns"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
          id="name"
          name="name"
          label="Full Name"
          placeholder="John Doe"
          value={form.name}
          onChange={handleChange}
          error={errors.name}
          required
          autoComplete="name"
          autoFocus
        />

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

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <UserPlus size={16} />
          )}
          {isLoading ? 'Creating account…' : 'Create Account'}
        </button>

        <p className="text-center text-xs text-[var(--text-muted)]">
          By creating an account you agree to our{' '}
          <Link to="/terms" className="text-brand-400 hover:underline">Terms</Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-brand-400 hover:underline">Privacy Policy</Link>
        </p>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default RegisterPage;
