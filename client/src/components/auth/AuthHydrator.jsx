import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useAuthStore from '../../store/useAuthStore';
import { shouldSkipAuthHydrate } from '../../utils/publicAuthRoutes';

/**
 * Restores auth on cold load, except on public visitor routes (AR, hub, card)
 * where /auth/refresh would 401 for anonymous scanners and clutter iOS Safari.
 */
const AuthHydrator = () => {
  const { pathname } = useLocation();
  const hydrate = useAuthStore((s) => s.hydrate);
  const skipAuthHydrate = useAuthStore((s) => s.skipAuthHydrate);

  useEffect(() => {
    if (shouldSkipAuthHydrate(pathname)) {
      skipAuthHydrate();
      return;
    }
    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- cold load only

  return null;
};

export default AuthHydrator;
