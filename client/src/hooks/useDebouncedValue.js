import { useEffect, useState } from 'react';

/**
 * useDebouncedValue — returns `value` after it has been stable for `delay` ms.
 *
 * Used by the QR designer to avoid thrashing the qr-code-styling canvas while
 * the user drags a color picker or scrubs a slider.  Each new value resets the
 * timer; only the *last* value is committed.
 */
export default function useDebouncedValue(value, delay = 150) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
