import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import AuthCard from '../../components/ui/AuthCard';
import FormInput from '../../components/ui/FormInput';
import { authService } from '../../services/authService';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return setEmailError('Email is required');
    if (!/\S+@\S+\.\S+/.test(email)) return setEmailError('Enter a valid email');

    setIsLoading(true);
    setApiError('');
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setApiError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard title="Check your inbox" subtitle="">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 py-4 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle2 size={32} className="text-green-400" />
          </div>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            If an account exists for{' '}
            <span className="font-semibold text-[var(--text-primary)]">{email}</span>, we&apos;ve
            sent a password reset link. Check your spam folder too.
          </p>
          <Link
            to="/login"
            className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-brand-400 hover:text-brand-300 hover:underline"
          >
            <ArrowLeft size={16} />
            Back to Sign In
          </Link>
        </motion.div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a reset link"
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
          id="email"
          name="email"
          type="email"
          label="Email address"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError('');
          }}
          error={emailError}
          required
          autoComplete="email"
          autoFocus
        />

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-500 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {isLoading ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
        Remember your password?{' '}
        <Link to="/login" className="font-medium text-brand-400 hover:text-brand-300 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
};

export default ForgotPasswordPage;
