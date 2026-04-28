import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, Loader2 } from 'lucide-react';
import AuthCard from '../../components/ui/AuthCard';
import FormInput from '../../components/ui/FormInput';
import useAuthStore from '../../store/useAuthStore';

/* ── Simple client-side validation ──────────────────────────────── */
const validate = ({ email, password }) => {
  const errs = {};
  if (!email) errs.email = 'Email is required';
  else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email';
  if (!password) errs.password = 'Password is required';
  return errs;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading } = useAuthStore();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  const from = location.state?.from?.pathname || '/dashboard';

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
      navigate(from, { replace: true });
    } else {
      setApiError(result.message);
    }
  };

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your Phygital8ThWall account"
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
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
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <LogIn size={16} />
          )}
          {isLoading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
        Don&apos;t have an account?{' '}
        <Link to="/register" className="font-medium text-brand-400 hover:text-brand-300 hover:underline">
          Create one free
        </Link>
      </p>
    </AuthCard>
  );
};

export default LoginPage;
