import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import AuthCard from '../../components/ui/AuthCard';
import FormInput from '../../components/ui/FormInput';
import { authService } from '../../services/authService';

/* ── Client-side validation ──────────────────────────────────────── */
const validate = ({ password, confirmPassword }) => {
  const errs = {};
  if (!password) errs.password = 'New password is required';
  else if (password.length < 8) errs.password = 'Minimum 8 characters';
  else if (!/[A-Z]/.test(password)) errs.password = 'Must contain an uppercase letter';
  else if (!/[0-9]/.test(password)) errs.password = 'Must contain a number';
  if (!confirmPassword) errs.confirmPassword = 'Please confirm your password';
  else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
  return errs;
};

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors((p) => ({ ...p, [e.target.name]: '' }));
    if (apiError) setApiError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) return setErrors(errs);

    setIsLoading(true);
    try {
      await authService.resetPassword(token, form.password, form.confirmPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err) {
      setApiError(
        err.response?.data?.message ||
          'Reset link is invalid or has expired. Please request a new one.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <AuthCard title="Password reset!" subtitle="">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 py-4 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Your password has been reset successfully. Redirecting you to sign in…
          </p>
          <Link
            to="/login"
            className="text-sm font-medium text-brand-400 hover:text-brand-300 hover:underline"
          >
            Go to Sign In now
          </Link>
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a strong password for your account"
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
          id="password"
          name="password"
          type="password"
          label="New Password"
          placeholder="Min 8 chars, 1 uppercase, 1 number"
          value={form.password}
          onChange={handleChange}
          error={errors.password}
          required
          autoComplete="new-password"
          autoFocus
        />

        <FormInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm New Password"
          placeholder="Re-enter your new password"
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
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          {isLoading ? 'Resetting…' : 'Reset Password'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
        Back to{' '}
        <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300 hover:underline">
          Sign In
        </Link>
      </p>
    </AuthCard>
  );
};

export default ResetPasswordPage;
