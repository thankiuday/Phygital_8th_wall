import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, QrCode, ArrowLeft, Shield, BarChart3, Ticket, Sparkles, Bell } from 'lucide-react';
import Footer from '../../components/ui/Footer';
import NotificationProvider from '../../components/notifications/NotificationProvider';
import useNotificationStore from '../../store/useNotificationStore';

const TABS = [
  { to: '/admin',              icon: LayoutDashboard, label: 'Overview',  end: true },
  { to: '/admin/analytics',    icon: BarChart3,       label: 'Analytics' },
  { to: '/admin/users',        icon: Users,           label: 'Users' },
  { to: '/admin/campaigns',    icon: QrCode,          label: 'Campaigns' },
  { to: '/admin/coupons',      icon: Ticket,          label: 'Coupons' },
  { to: '/admin/ar-requests',  icon: Sparkles,        label: 'AR Requests' },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
  <NotificationProvider>
  <div className="min-h-screen bg-[var(--bg-primary)]">
    {/* ── Top bar ──────────────────────────────────────────────────────── */}
    <header className="sticky top-0 z-30 flex flex-col gap-2 border-b border-[var(--border-color)] bg-[var(--surface-1)]/90 px-4 py-2 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-0 sm:h-14">
      {/* Brand row (mobile) — keeps logo + back link visible while tabs scroll below */}
      <div className="flex items-center gap-3">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-brand-400"
        >
          <ArrowLeft size={13} /> Dashboard
        </Link>

        <div className="mx-1 h-4 w-px bg-[var(--border-color)] sm:mx-3" />

        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/20">
            <Shield size={13} className="text-red-400" />
          </div>
          <span className="text-sm font-bold text-[var(--text-primary)]">Admin Panel</span>
        </div>

        <button
          type="button"
          onClick={() => navigate('/dashboard/notifications')}
          className="relative ml-auto inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-brand-500/50 hover:text-brand-400 sm:ml-0"
          aria-label="Notifications"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
              {Math.min(unreadCount, 9)}
            </span>
          )}
        </button>
      </div>

      {/* Tab navigation — horizontally scrollable on mobile so 3 pills can pan
          instead of clipping. Each pill keeps a 44 px tap height. */}
      <nav className="-mx-2 flex items-center gap-1 overflow-x-auto px-2 pb-1 scrollbar-hide sm:ml-auto sm:mx-0 sm:overflow-visible sm:pb-0">
        {TABS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex shrink-0 min-h-[44px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-brand-600/15 text-brand-400'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`
            }
          >
            <Icon size={13} />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>

    {/* ── Page content ─────────────────────────────────────────────────── */}
    <motion.main
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
    >
      <Outlet />
    </motion.main>
    <Footer />
  </div>
  </NotificationProvider>
  );
};

export default AdminLayout;
