/**
 * Public visitor experiences that must not call /auth/refresh on load.
 * A failed refresh shows as a noisy 401 in mobile Safari and can interfere
 * with camera / AR startup on iOS.
 */
export const shouldSkipAuthHydrate = (pathname) => {
  if (!pathname || typeof pathname !== 'string') return false;
  return (
    pathname.startsWith('/ar/')
    || pathname.startsWith('/l/')
    || pathname.startsWith('/card/')
    || pathname.startsWith('/open/')
    || pathname.startsWith('/print/card/')
  );
};
