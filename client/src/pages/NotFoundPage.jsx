import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';

const NotFoundPage = () => {
  const { isAuthenticated } = useAuthStore();
  const returnPath = isAuthenticated ? '/dashboard' : '/';
  const returnLabel = isAuthenticated ? 'Back to Dashboard' : 'Back to Home';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex w-full max-w-full flex-col items-center gap-5 overflow-hidden"
      >
        {/* Hero scales with viewport so it never causes horizontal scroll on
            tiny phones — clamp(4rem, 25vw, 7.5rem) = ~64px to ~120px. */}
        <span
          className="gradient-text font-black leading-none"
          style={{ fontSize: 'clamp(4rem, 25vw, 7.5rem)' }}
        >
          404
        </span>
        <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">Page not found</h1>
        <p className="max-w-sm text-sm text-[var(--text-secondary)] sm:text-base">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to={returnPath}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-500"
        >
          <ArrowLeft size={16} />
          {returnLabel}
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
