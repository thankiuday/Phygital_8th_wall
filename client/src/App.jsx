import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import useThemeStore, { applyThemeClass } from './store/useThemeStore';
import useAuthStore from './store/useAuthStore';

// Layouts
import PublicLayout    from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';

// Guards + shared loaders
import { ProtectedRoute, AdminRoute } from './components/ui/ProtectedRoute';
import RouteSkeleton from './components/ui/RouteSkeleton';
import ErrorBoundary from './components/ui/ErrorBoundary';

// ── Eagerly-loaded pages (small, needed on first paint) ──────────────────────
import LandingPage        from './pages/LandingPage';
import NotFoundPage       from './pages/NotFoundPage';
import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';
import ARExperiencePage   from './pages/ARExperiencePage';
import OpenSingleLinkBridgePage from './pages/OpenSingleLinkBridgePage';

// ── Lazily-loaded pages (split by route — dramatically reduces initial bundle) ─
const DashboardPage          = lazy(() => import('./pages/dashboard/DashboardPage'));
const CampaignsListPage      = lazy(() => import('./pages/campaigns/CampaignsListPage'));
const NewCampaignPage        = lazy(() => import('./pages/campaigns/NewCampaignPage'));
const PhygitalizePickerPage  = lazy(() => import('./pages/campaigns/PhygitalizePickerPage'));
const ComingSoonPage         = lazy(() => import('./pages/campaigns/ComingSoonPage'));
const SingleLinkQrWizard     = lazy(() => import('./pages/campaigns/SingleLinkQrWizard'));
const MultipleLinksQrWizard  = lazy(() => import('./pages/campaigns/MultipleLinksQrWizard'));
const LinksVideoQrWizard     = lazy(() => import('./pages/campaigns/LinksVideoQrWizard'));
const LinksDocVideoQrWizard  = lazy(() => import('./pages/campaigns/LinksDocVideoQrWizard'));
const LinkHubPage            = lazy(() => import('./pages/LinkHubPage'));
const CampaignDetailPage     = lazy(() => import('./pages/campaigns/CampaignDetailPage'));
const AnalyticsPage          = lazy(() => import('./pages/analytics/AnalyticsPage'));
const CampaignAnalyticsPage  = lazy(() => import('./pages/analytics/CampaignAnalyticsPage'));
const AccountSettingsPage    = lazy(() => import('./pages/settings/AccountSettingsPage'));
const AdminLayout            = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboardPage     = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage         = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminCampaignsPage     = lazy(() => import('./pages/admin/AdminCampaignsPage'));

// ── Route-level Suspense wrapper ──────────────────────────────────────────────
// Inner routes use a lightweight, layout-shaped skeleton so the dashboard /
// admin shell stays visible while a code-split chunk loads. PageLoader (a
// full-screen brand splash) is still used by the auth guards for the very
// first render (auth hydrate).
const RouteLoader = ({ children }) => (
  <Suspense fallback={<RouteSkeleton />}>
    {children}
  </Suspense>
);

/**
 * App — root component.
 *
 * On mount:
 * 1. Syncs the saved theme to <html>
 * 2. Calls hydrate() to silently restore the user's session via refresh cookie
 */
function App() {
  const { theme } = useThemeStore();
  const { hydrate } = useAuthStore();

  useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  // Restore session once on cold load
  useEffect(() => {
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* ── Public marketing pages ────────────────────────────── */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
            </Route>

            {/* ── Auth pages (no navbar/footer) ─────────────────────── */}
            <Route path="/login"                  element={<LoginPage />} />
            <Route path="/register"               element={<RegisterPage />} />
            <Route path="/forgot-password"        element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token"  element={<ResetPasswordPage />} />

            {/* ── Protected dashboard routes ─────────────────────────── */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<RouteLoader><DashboardPage /></RouteLoader>} />
              <Route path="campaigns"            element={<RouteLoader><CampaignsListPage /></RouteLoader>} />
              <Route path="campaigns/new"        element={<RouteLoader><PhygitalizePickerPage /></RouteLoader>} />
              <Route path="campaigns/new/phygital-qr/links-video"      element={<RouteLoader><LinksVideoQrWizard /></RouteLoader>} />
              <Route path="campaigns/new/phygital-qr/links-doc-video"  element={<RouteLoader><LinksDocVideoQrWizard /></RouteLoader>} />
              <Route path="campaigns/new/dynamic-qr/single-link"       element={<RouteLoader><SingleLinkQrWizard /></RouteLoader>} />
              <Route path="campaigns/new/dynamic-qr/multiple-links"    element={<RouteLoader><MultipleLinksQrWizard /></RouteLoader>} />
              <Route path="campaigns/new/digital-business-card/personalized-identity" element={<RouteLoader><ComingSoonPage type="Personalized Identity Card" /></RouteLoader>} />
              <Route path="campaigns/new/digital-business-card/ar"     element={<RouteLoader><NewCampaignPage /></RouteLoader>} />
              <Route path="campaigns/:id"        element={<RouteLoader><CampaignDetailPage /></RouteLoader>} />
              <Route path="campaigns/:id/analytics" element={<RouteLoader><CampaignAnalyticsPage /></RouteLoader>} />
              <Route path="analytics"            element={<RouteLoader><AnalyticsPage /></RouteLoader>} />
              <Route path="settings"             element={<RouteLoader><AccountSettingsPage /></RouteLoader>} />
            </Route>

            {/* ── Admin routes ──────────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <RouteLoader><AdminLayout /></RouteLoader>
                </AdminRoute>
              }
            >
              <Route index        element={<RouteLoader><AdminDashboardPage /></RouteLoader>} />
              <Route path="users"     element={<RouteLoader><AdminUsersPage /></RouteLoader>} />
              <Route path="campaigns" element={<RouteLoader><AdminCampaignsPage /></RouteLoader>} />
            </Route>

            {/* ── Public multi-link hub (first-party link page) ─────── */}
            <Route
              path="/l/:slug"
              element={
                <Suspense fallback={<RouteSkeleton />}>
                  <LinkHubPage />
                </Suspense>
              }
            />

            {/* ── Public single-link / multi-link bridge (precise geo) ─ */}
            <Route path="/open/:slug" element={<OpenSingleLinkBridgePage />} />

            {/* ── Public AR experience ──────────────────────────────── */}
            <Route path="/ar/:campaignId" element={<ARExperiencePage />} />

            {/* ── Fallback ──────────────────────────────────────────── */}
            <Route path="/404" element={<NotFoundPage />} />
            <Route path="*"    element={<Navigate to="/404" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </HelmetProvider>
  );
}

export default App;
