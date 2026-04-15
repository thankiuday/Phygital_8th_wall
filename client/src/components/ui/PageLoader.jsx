import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

/**
 * PageLoader — full-screen loading spinner shown during session hydration
 * or any page-level async state.
 */
const PageLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-[var(--bg-primary)]">
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow-lg"
      >
        <Zap size={24} className="text-white" />
      </motion.div>

      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-brand-500"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
};

export default PageLoader;
