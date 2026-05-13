import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
import AboutPage          from './pages/AboutPage';
import ContactPage        from './pages/ContactPage';
import PricingPage        from './pages/PricingPage';
import NotFoundPage       from './pages/NotFoundPage';
import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';
import GoogleAuthCallbackPage from './pages/auth/GoogleAuthCallbackPage';
import ARExperiencePage   from './pages/ARExperiencePage';
import OpenSingleLinkBridgePage from './pages/OpenSingleLinkBridgePage';
import UserCertificationAgreementPage from './pages/UserCertificationAgreementPage';

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
const DigitalBusinessCardWizard = lazy(() => import('./pages/campaigns/DigitalBusinessCardWizard'));
const DigitalCardPublicPage  = lazy(() => import('./pages/DigitalCardPublicPage'));
const DigitalCardPrintPage   = lazy(() => import('./pages/DigitalCardPrintPage'));
const LinkHubPage            = lazy(() => import('./pages/LinkHubPage'));
const CampaignDetailPage     = lazy(() => import('./pages/campaigns/CampaignDetailPage'));
const AnalyticsPage          = lazy(() => import('./pages/analytics/AnalyticsPage'));
const CampaignAnalyticsPage  = lazy(() => import('./pages/analytics/CampaignAnalyticsPage'));
const AccountSettingsPage    = lazy(() => import('./pages/settings/AccountSettingsPage'));
const ProfilePage            = lazy(() => import('./pages/settings/ProfilePage'));
const NotificationsPage      = lazy(() => import('./pages/notifications/NotificationsPage'));
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

const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);
  return null;
};

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
          <ScrollToTop />
          <Routes>
            {/* ── Public marketing pages ────────────────────────────── */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/phygitalize-now" element={<RouteLoader><PhygitalizePickerPage /></RouteLoader>} />
              <Route path="/create/phygital-qr/links-video" element={<RouteLoader><LinksVideoQrWizard /></RouteLoader>} />
              <Route path="/create/phygital-qr/links-doc-video" element={<RouteLoader><LinksDocVideoQrWizard /></RouteLoader>} />
              <Route path="/create/dynamic-qr/single-link" element={<RouteLoader><SingleLinkQrWizard /></RouteLoader>} />
              <Route path="/create/dynamic-qr/multiple-links" element={<RouteLoader><MultipleLinksQrWizard /></RouteLoader>} />
            </Route>

            {/* ── Auth pages (no navbar/footer) ─────────────────────── */}
            <Route path="/login"                  element={<LoginPage />} />
            <Route path="/register"               element={<RegisterPage />} />
            <Route path="/forgot-password"        element={<ForgotPasswordPage />} />
            <Route path="/reset-password/:token"  element={<ResetPasswordPage />} />
            <Route path="/auth/google/callback"   element={<GoogleAuthCallbackPage />} />
            <Route path="/user-certification-agreement" element={<UserCertificationAgreementPage />} />

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
              <Route path="campaigns/new/digital-business-card/personalized-identity" element={<RouteLoader><DigitalBusinessCardWizard /></RouteLoader>} />
              <Route path="campaigns/new/digital-business-card/ar"     element={<RouteLoader><NewCampaignPage /></RouteLoader>} />
              <Route path="campaigns/:id"        element={<RouteLoader><CampaignDetailPage /></RouteLoader>} />
              <Route path="campaigns/:id/analytics" element={<RouteLoader><CampaignAnalyticsPage /></RouteLoader>} />
              <Route path="analytics"            element={<RouteLoader><AnalyticsPage /></RouteLoader>} />
              <Route path="notifications"        element={<RouteLoader><NotificationsPage /></RouteLoader>} />
              <Route path="profile"              element={<RouteLoader><ProfilePage /></RouteLoader>} />
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

            {/* ── Public digital business card hub ──────────────────── */}
            <Route
              path="/card/:slug"
              element={
                <Suspense fallback={<RouteSkeleton />}>
                  <DigitalCardPublicPage />
                </Suspense>
              }
            />

            {/* ── Print render route (Puppeteer hits this) ──────────── */}
            <Route
              path="/print/card/:id"
              element={
                <Suspense fallback={<RouteSkeleton />}>
                  <DigitalCardPrintPage />
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
