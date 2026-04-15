import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from '../components/ui/Sidebar';
import DashboardTopBar from '../components/ui/DashboardTopBar';

/* ── Map route paths to readable page titles ─────────────────────── */
const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/dashboard/campaigns': 'Campaigns',
  '/dashboard/campaigns/new': 'New Campaign',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
};

/**
 * DashboardLayout — shell for all authenticated pages.
 *
 * - Collapsible sidebar (desktop)
 * - Slide-over drawer (mobile)
 * - Animated page content transitions
 */
const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)]">
      {/* ── Desktop sidebar ─────────────────────────────────────── */}
      <div className="hidden lg:flex">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed((p) => !p)}
        />
      </div>

      {/* ── Mobile sidebar drawer ───────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 z-50 h-full lg:hidden"
            >
              <Sidebar
                collapsed={false}
                onCollapse={() => setMobileOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Main content ────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopBar
          title={pageTitle}
          onMobileMenuOpen={() => setMobileOpen(true)}
        />

        {/* Page content — animated on route change */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="h-full p-4 md:p-6"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
