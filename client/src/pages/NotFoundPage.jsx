import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const NotFoundPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-5"
      >
        <span className="gradient-text text-[120px] font-black leading-none">404</span>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Page not found</h1>
        <p className="max-w-sm text-[var(--text-secondary)]">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:bg-brand-500"
        >
          <ArrowLeft size={16} />
          Back to Home
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;
