import { useEffect, useState } from 'react';

/**
 * Animate a number from 0 to `end` over `duration` ms.
 */
export function useCountUp(end, duration = 800) {
  const target = Number(end) || 0;
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) {
      setValue(0);
      return undefined;
    }

    let start = null;
    let raf = null;

    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return value;
}
