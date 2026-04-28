import { useEffect, useState } from 'react';

/**
 * useIsMobile — true when `window.innerWidth` is below `breakpoint`.
 *
 * Defaults to 640 px (Tailwind's `sm:` boundary). Used to drive responsive
 * Recharts margins and a few other JS-side layout tweaks where pure CSS
 * can't reach (e.g. Recharts' YAxis width).
 *
 * SSR-safe: starts as `false` and updates after mount.
 */
const useIsMobile = (breakpoint = 640) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e) => setIsMobile(e.matches);

    setIsMobile(mql.matches);

    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange); // Safari < 14

    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [breakpoint]);

  return isMobile;
};

export default useIsMobile;
