import { NavLink, Outlet, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Users, QrCode, ArrowLeft, Shield } from 'lucide-react';

const TABS = [
  { to: '/admin',           icon: LayoutDashboard, label: 'Overview',  end: true },
  { to: '/admin/users',     icon: Users,           label: 'Users' },
  { to: '/admin/campaigns', icon: QrCode,          label: 'Campaigns' },
];

const AdminLayout = () => (
  <div className="min-h-screen bg-[var(--bg-primary)]">
    {/* ── Top bar ──────────────────────────────────────────────────────── */}
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-[var(--border-color)] bg-[var(--surface-1)]/90 px-6 backdrop-blur-sm">
      {/* Back to dashboard */}
      <Link
        to="/dashboard"
        className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] transition-colors hover:text-brand-400"
      >
        <ArrowLeft size={13} /> Dashboard
      </Link>

      <div className="mx-3 h-4 w-px bg-[var(--border-color)]" />

      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500/20">
          <Shield size={13} className="text-red-400" />
        </div>
        <span className="text-sm font-bold text-[var(--text-primary)]">Admin Panel</span>
      </div>

      {/* Tab navigation */}
      <nav className="ml-auto flex items-center gap-1">
        {TABS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
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
      className="mx-auto max-w-7xl px-6 py-8"
    >
      <Outlet />
    </motion.main>
  </div>
);

export default AdminLayout;
