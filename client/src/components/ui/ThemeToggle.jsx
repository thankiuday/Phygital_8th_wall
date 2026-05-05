import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Zap } from 'lucide-react';
import useThemeStore from '../../store/useThemeStore';

/**
 * ThemeToggle — animated theme switch button (dark/light/neon).
 * Drop this anywhere in the navbar or header.
 */
const ThemeToggle = ({ className = '' }) => {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';
  const isNeon = theme === 'neon';
  const nextTheme = isDark ? 'light' : isNeon ? 'dark' : 'neon';

  return (
    <motion.button
      onClick={toggleTheme}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.05 }}
      aria-label={`Switch to ${nextTheme} mode`}
      className={`
        relative flex h-11 w-11 items-center justify-center rounded-xl
        border transition-all duration-300
        ${isDark
          ? 'border-surface-700 bg-surface-800 text-brand-400 hover:border-brand-500 hover:bg-surface-700'
          : isNeon
            ? 'border-cyan-400/40 bg-slate-900 text-cyan-300 hover:border-fuchsia-400/70 hover:text-fuchsia-300'
            : 'border-surface-200 bg-surface-100 text-brand-600 hover:border-brand-300 hover:bg-surface-200'}
        ${className}
      `}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Moon size={16} />
          </motion.span>
        ) : isNeon ? (
          <motion.span
            key="zap"
            initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Zap size={16} />
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Sun size={16} />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default ThemeToggle;
