import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

/**
 * AuthCard — shared wrapper for all auth pages (Login, Register, etc).
 * Renders a centred glass card with the brand logo + title.
 */
const AuthCard = ({ title, subtitle, children }) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-[var(--bg-primary)]">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden>
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/15 blur-[100px] dark:bg-brand-700/25" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
            <Zap size={18} className="text-white" />
          </span>
          <span className="gradient-text text-xl font-bold tracking-tight">Phygital8ThWall</span>
        </Link>

        {/* Card */}
        <div className="glass-card p-8">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
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
