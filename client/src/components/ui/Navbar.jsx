import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Zap, ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import useAuthStore from '../../store/useAuthStore';

const NAV_LINKS = [
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

/**
 * Navbar — responsive top navigation with:
 * - Glass morphism background on scroll
 * - Desktop nav links
 * - Dark/light toggle
 * - Mobile hamburger with slide-down glass menu
 */
const Navbar = () => {
  const { user, isAuthenticated, isHydrating, logout } = useAuthStore();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

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
    setMobileOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled || mobileOpen
          ? 'border-b border-[var(--border-color)] bg-[var(--glass-bg)] shadow-[var(--shadow-sm)] backdrop-blur-[var(--glass-blur)] [-webkit-backdrop-filter:blur(var(--glass-blur))]'
          : 'border-b border-transparent bg-transparent'
      }`}
      style={{ height: 'var(--navbar-height)' }}
    >
      <div className="content-width pt-safe flex h-full items-center justify-between px-4 sm:px-6 md:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold" onClick={() => setMobileOpen(false)}>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand shadow-glow">
            <Zap size={16} className="text-white" />
          </span>
          <span className="gradient-text text-base sm:text-lg tracking-tight">Phygital8ThWall</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--brand)]"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {isHydrating ? (
            <div
              className="hidden h-9 w-28 animate-pulse rounded-xl bg-[var(--surface-3)] md:block"
              aria-hidden
            />
          ) : isAuthenticated && user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--glass-bg)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] backdrop-blur-sm transition-colors hover:border-brand-500/50 hover:text-brand-400 md:inline-flex"
              >
                <LayoutDashboard size={16} />
                Dashboard
              </Link>
              <div className="relative hidden md:block" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--glass-bg)] px-3 py-2 backdrop-blur-sm transition-colors hover:border-brand-500/50"
                  aria-label="Account menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                    {user.avatar ? (
                      <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <span className="max-w-[8rem] truncate text-sm font-medium text-[var(--text-primary)]">
                    {user.name?.split(' ')[0] || 'Account'}
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-[var(--text-muted)] transition-transform ${userMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-solid)] p-1.5 shadow-[var(--shadow-lg)]"
                    >
                      <div className="mb-1 border-b border-[var(--border-color)] px-3 pb-2 pt-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{user.name}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">{user.email}</p>
                      </div>
                      <Link
                        to="/dashboard"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]"
                      >
                        <LayoutDashboard size={14} />
                        Dashboard
                      </Link>
                      <div className="mt-1 border-t border-[var(--border-color)] pt-1">
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                        >
                          <LogOut size={14} />
                          Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-xl px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--brand)] md:block"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="hidden rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all duration-200 hover:bg-brand-500 hover:shadow-glow-lg md:block"
              >
                Get Started Free
              </Link>
            </>
          )}

          {/* Mobile hamburger — full 44×44 tap target (WCAG 2.5.5) */}
          <button
            onClick={() => setMobileOpen((p) => !p)}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--glass-bg)] backdrop-blur-sm [-webkit-backdrop-filter:blur(8px)] text-[var(--text-primary)] transition-colors hover:border-brand-500/50 hover:text-brand-400 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={mobileOpen ? 'close' : 'open'}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      {/* Mobile menu — full-width slide down. The drawer panel itself is fully
          opaque (theme-aware) so page content is hidden behind it; the header
          bar above keeps its glass treatment for that premium feel. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav-drawer"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden border-t border-[var(--border-color)] bg-[var(--surface-solid)] shadow-lg md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-600/10 text-brand-400'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--brand)]'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}

              {/* Auth / account */}
              <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border-color)] pt-3">
                {isHydrating ? (
                  <div className="h-11 animate-pulse rounded-xl bg-[var(--surface-3)]" aria-hidden />
                ) : isAuthenticated && user ? (
                  <>
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
                    >
                      <LayoutDashboard size={16} />
                      Dashboard
                    </Link>
                    <p className="px-1 text-center text-xs text-[var(--text-muted)]">
                      Signed in as <span className="font-medium text-[var(--text-secondary)]">{user.name}</span>
                    </p>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                    >
                      <LogOut size={16} />
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] px-4 py-3 text-center text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-brand-500/50 hover:text-brand-400"
                    >
                      Sign In
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500"
                    >
                      Get Started Free
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
