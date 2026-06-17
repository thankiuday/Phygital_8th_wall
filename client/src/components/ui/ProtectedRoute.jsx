import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import PageLoader from './PageLoader';
import { useEffect } from 'react';

/**
 * ProtectedRoute — wraps routes that require authentication.
 *
 * While the session is being hydrated (isHydrating = true), shows a full-page
 * spinner so the user never sees a flash-redirect to /login.
 * Once resolved:
 *   - Authenticated → render children
 *   - Not authenticated → redirect to /login, preserving the intended URL
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isHydrating, authHydrateDeferred, hydrate } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (authHydrateDeferred && !isAuthenticated && !isHydrating) {
      hydrate();
    }
  }, [authHydrateDeferred, isAuthenticated, isHydrating, hydrate]);

  if (isHydrating) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * AdminRoute — wraps admin-only routes.
 * Redirects non-admin users to the dashboard.
 */
const AdminRoute = ({ children }) => {
  const { isAuthenticated, isHydrating, authHydrateDeferred, hydrate, user } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (authHydrateDeferred && !isAuthenticated && !isHydrating) {
      hydrate();
    }
  }, [authHydrateDeferred, isAuthenticated, isHydrating, hydrate]);

  if (isHydrating) return <PageLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export { ProtectedRoute, AdminRoute };
