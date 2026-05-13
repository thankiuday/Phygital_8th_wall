import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Settings, LogOut, User, ChevronDown, Menu } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import useAuthStore from '../../store/useAuthStore';

/**
 * DashboardTopBar — fixed header for all dashboard pages.
 * Shows page title (slot via prop), theme toggle, notifications, user menu.
 */
const DashboardTopBar = ({ title = 'Dashboard', onMobileMenuOpen }) => {
  const { user, logout, pendingWelcomeNotification } = useAuthStore();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close user menu on outside click. Uses pointerdown so iOS Safari taps
  // (which sometimes never fire mousedown) reliably dismiss the menu.
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--border-color)] bg-[var(--surface-1)] px-4 md:px-6">
      {/* Left — mobile menu + page title */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMobileMenuOpen}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] lg:hidden"
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</h1>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />

        <button
          type="button"
          onClick={() => navigate('/dashboard/notifications')}
          className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
          aria-label="Notifications"
        >
          <Bell size={16} />
          {pendingWelcomeNotification && (
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
          )}
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen((p) => !p)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 transition-colors hover:border-brand-500/50"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
              {initials}
            </div>
            <span className="hidden text-sm font-medium text-[var(--text-primary)] md:block">
              {user?.name?.split(' ')[0] || 'User'}
            </span>
            <ChevronDown
              size={14}
              className={`text-[var(--text-muted)] transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-1)] p-1.5 shadow-[var(--shadow-lg)]"
              >
                {/* User info */}
                <div className="mb-1 border-b border-[var(--border-color)] px-3 pb-2 pt-1">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{user?.name}</p>
                  <p className="truncate text-xs text-[var(--text-muted)]">{user?.email}</p>
                </div>

                <Link
                  to="/dashboard/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <User size={14} />
                  Profile
                </Link>
                <Link
                  to="/dashboard/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                >
                  <Settings size={14} />
                  Settings
                </Link>

                <div className="mt-1 border-t border-[var(--border-color)] pt-1">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default DashboardTopBar;
