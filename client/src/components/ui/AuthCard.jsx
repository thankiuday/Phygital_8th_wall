import { motion } from 'framer-motion';
import BrandLockup from './BrandLockup';

/**
 * AuthCard — shared wrapper for all auth pages (Login, Register, etc).
 * Renders a centred glass card with the brand logo + title.
 * Fully responsive: comfortable on 320 px phones up to desktop.
 */
const AuthCard = ({ title, subtitle, children }) => {
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] px-4 py-8 sm:py-12"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
    >
      {/* Background glow blob */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/15 blur-[80px] sm:h-[500px] sm:w-[500px] sm:blur-[100px] dark:bg-brand-700/25" />
        <div className="absolute right-0 top-0 h-[200px] w-[200px] -translate-y-1/4 translate-x-1/4 rounded-full bg-accent-500/10 blur-[60px]" />
        <div className="absolute bottom-0 left-0 h-[200px] w-[200px] translate-y-1/4 -translate-x-1/4 rounded-full bg-brand-700/10 blur-[60px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center sm:mb-8">
          <BrandLockup
            variant="auth"
            className="flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-4"
          />
        </div>

        {/* Card — solid surface on phones so the keyboard area stays
            readable; restores the glass treatment from sm: up via a CSS
            module-style override below. */}
        <div className="auth-card-surface rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] p-5 shadow-[var(--shadow-md)] sm:p-8">
          <div className="mb-5 text-center sm:mb-6">
            <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">{title}</h1>
            {subtitle && (
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthCard;
