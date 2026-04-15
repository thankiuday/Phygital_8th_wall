import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

/**
 * AuthCard — shared wrapper for all auth pages (Login, Register, etc).
 * Renders a centred glass card with the brand logo + title.
 * Fully responsive: comfortable on 320 px phones up to desktop.
 */
const AuthCard = ({ title, subtitle, children }) => {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--bg-primary)] px-4 py-8 sm:py-12">
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
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 sm:mb-8">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <Zap size={18} className="text-white" />
          </span>
          <span className="gradient-text text-xl font-bold tracking-tight">Phygital8ThWall</span>
        </Link>

        {/* Card */}
        <div className="glass-card p-5 sm:p-8">
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
