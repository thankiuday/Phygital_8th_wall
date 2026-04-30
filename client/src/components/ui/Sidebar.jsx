import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  QrCode,
  BarChart3,
  Settings,
  LogOut,
  Zap,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Shield,
} from 'lucide-react';
import useAuthStore from '../../store/useAuthStore';
import { cn } from '../../utils/cn';

/* ── Nav link definitions ────────────────────────────────────────── */
const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/dashboard/campaigns', icon: QrCode, label: 'Campaigns' },
  { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
];

const ADMIN_ITEMS = [
  { to: '/admin', icon: Shield, label: 'Admin Panel' },
];

/* ── Single nav item ─────────────────────────────────────────────── */
const SidebarLink = ({ to, icon: Icon, label, collapsed, end, onNavigate }) => (
  <NavLink
    to={to}
    end={end}
    onClick={onNavigate}
    className={({ isActive }) =>
      cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
        isActive
          ? 'bg-brand-600/15 text-brand-400 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.2)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]'
      )
    }
    title={collapsed ? label : undefined}
  >
    <Icon size={18} className="shrink-0" />
    <AnimatePresence>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 'auto' }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden whitespace-nowrap"
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  </NavLink>
);

/* ── Sidebar component ───────────────────────────────────────────── */
// `onCollapse` toggles the desktop rail; `onNavigate` is fired on every link
// click so the parent (DashboardLayout) can close its mobile drawer.
const Sidebar = ({ collapsed, onCollapse, onNavigate }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // User avatar initials
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex h-full flex-col border-r border-[var(--border-color)] bg-[var(--surface-1)]"
    >
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="flex h-16 items-center gap-3 border-b border-[var(--border-color)] px-4">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-brand shadow-glow">
            <Zap size={16} className="text-white" />
          </span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="gradient-text text-sm font-bold whitespace-nowrap"
              >
                Phygital8ThWall
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Phygitalize now CTA — opens the picker page ──────────── */}
      <div className={cn('p-3', collapsed && 'px-2')}>
        <Link
          to="/dashboard/campaigns/new"
          onClick={onNavigate}
          className={cn(
            'flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-500 hover:shadow-glow-lg',
            collapsed ? 'justify-center px-0' : 'px-3'
          )}
          title={collapsed ? 'Phygitalize now' : undefined}
        >
          <PlusCircle size={16} className="shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Phygitalize now
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* ── Nav links ────────────────────────────────────────────── */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} {...item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}

        {/* Admin section — only visible to admin role */}
        {user?.role === 'admin' && (
          <>
            <div className={cn('my-2 border-t border-[var(--border-color)]', collapsed && 'mx-1')} />
            {ADMIN_ITEMS.map((item) => (
              <SidebarLink key={item.to} {...item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </>
        )}
      </nav>

      {/* ── User section ─────────────────────────────────────────── */}
      <div className="border-t border-[var(--border-color)] p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white shadow-glow">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-full w-full rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-1 flex-col overflow-hidden"
              >
                <span className="truncate text-xs font-semibold text-[var(--text-primary)]">
                  {user?.name || 'User'}
                </span>
                <span className="truncate text-xs text-[var(--text-muted)]">
                  {user?.email}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {!collapsed && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                aria-label="Sign out"
                title="Sign out"
                className="shrink-0 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={16} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Logout when collapsed */}
        {collapsed && (
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>

      {/* ── Collapse toggle (desktop rail) ───────────────────────── */}
      <button
        onClick={onCollapse}
        className="absolute -right-4 top-20 hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--surface-1)] text-[var(--text-muted)] shadow-sm transition-colors hover:border-brand-500 hover:text-brand-400 lg:flex"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
};

export default Sidebar;
