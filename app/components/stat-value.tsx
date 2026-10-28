"use client";

import { useEffect, useRef, useState } from "react";

// Counts up from 0 to `value` on mount instead of just printing a static
// number — a small, honest bit of motion (not a loop, not on every
// re-render) that makes the dashboard feel alive rather than a screenshot.
export function StatValue({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return; // StrictMode double-invoke guard
    mounted.current = true;

    if (value === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }

    const duration = 650;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * value));
      if (t < 1) requestAnimationFrame(tick);
    }

    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{display}</>;
}
