import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Menu,
  X,
  ExternalLink,
  Globe,
  CreditCard,
  LogIn,
  UserPlus,
} from 'lucide-react';

/**
 * Hamburger quick-links menu shown on every public campaign hub page.
 * Mobile: full-width slide-down panel below the header.
 * Desktop: compact dropdown anchored to the button.
 */
const QUICK_LINKS = [
  { label: 'Phygital Platform', href: 'https://phygital.zone', external: true, icon: Globe },
  { label: 'Pricing', href: '/pricing', external: false, icon: CreditCard },
  { label: 'Login', href: '/login', external: false, icon: LogIn },
  { label: 'Register free', href: '/register', external: false, icon: UserPlus },
];

const PublicQuickLinksMenu = ({ theme = 'light' }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isDark = theme === 'dark';

  const btnCls = isDark
    ? 'border-white/15 bg-white/8 text-white/80 hover:border-brand-400/50 hover:text-white'
    : 'border-[var(--border-color)] bg-[var(--glass-bg,#fff)] text-[var(--text-primary)] hover:border-brand-500/50 hover:text-brand-500';

  const panelCls = isDark
    ? 'bg-[#0f172a] border-white/10'
    : 'bg-[var(--surface-solid,#fff)] border-[var(--border-color)]';

  const linkBaseCls = isDark
    ? 'text-white/70 hover:bg-white/8 hover:text-white'
    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]';

  const renderLink = (l) => {
    const Icon = l.icon;
    const inner = (
      <>
        <Icon size={16} className="shrink-0 opacity-70" aria-hidden />
        <span className="flex-1">{l.label}</span>
        {l.external && <ExternalLink size={13} className="shrink-0 opacity-50" aria-hidden />}
      </>
    );
    const cls = `flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${linkBaseCls}`;

    if (l.external) {
      return (
        <a
          key={l.href}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          onClick={() => setOpen(false)}
          className={cls}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link
        key={l.href}
        to={l.href}
        role="menuitem"
        onClick={() => setOpen(false)}
        className={cls}
      >
        {inner}
      </Link>
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="hub-quick-links-panel"
        onClick={() => setOpen((p) => !p)}
        className={`flex h-10 w-10 items-center justify-center rounded-xl border backdrop-blur-sm transition-colors ${btnCls}`}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 top-14 z-40 bg-black/30 md:hidden"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <motion.div
              id="hub-quick-links-panel"
              role="menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`fixed left-0 right-0 top-14 z-50 border-b p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-56 md:rounded-2xl md:border md:p-1.5 ${panelCls}`}
            >
              <p className={`mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider md:mb-1 md:border-b md:px-3 md:pb-2 md:pt-1 ${isDark ? 'md:border-white/10 text-white/30' : 'md:border-[var(--border-color)] text-[var(--text-muted)]'}`}>
                Quick links
              </p>
              <div className="flex flex-col gap-0.5">
                {QUICK_LINKS.map(renderLink)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicQuickLinksMenu;
