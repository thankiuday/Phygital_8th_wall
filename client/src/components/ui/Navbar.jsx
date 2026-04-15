import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Zap } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const NAV_LINKS = [
  { label: 'Features', to: '/#features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'About', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

/**
 * Navbar — responsive top navigation with:
 * - Logo + brand name
 * - Desktop nav links
 * - Dark/light toggle
 * - CTA buttons
 * - Mobile hamburger menu
 */
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'glass-card rounded-none border-b border-[var(--border-color)] shadow-[var(--shadow-sm)]'
          : 'border-b border-transparent bg-transparent'
      }`}
      style={{ height: 'var(--navbar-height)' }}
    >
      <div className="content-width flex h-full items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand shadow-glow">
            <Zap size={16} className="text-white" />
          </span>
          <span className="gradient-text text-lg tracking-tight">Phygital8ThWall</span>
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
        <div className="flex items-center gap-3">
          <ThemeToggle />
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((p) => !p)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] md:hidden"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-card rounded-none border-t border-[var(--border-color)] md:hidden"
          >
            <div className="flex flex-col gap-1 px-4 py-4">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--brand)]"
                >
                  {link.label}
                </NavLink>
              ))}
              <div className="mt-2 flex flex-col gap-2 border-t border-[var(--border-color)] pt-2">
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl border border-[var(--border-color)] px-4 py-2 text-center text-sm font-medium text-[var(--text-secondary)]"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Navbar;
