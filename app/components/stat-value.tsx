"use client";

import { useEffect, useState } from "react";

// 29 Oct 2026 (fourth pass): real bug fix, confirmed with the user — every
// dashboard stat tile was permanently stuck at 0 in `next dev`, even when
// the list directly below it (built from that exact same number) showed
// real rows. Root cause: React 18 Strict Mode (on by default in dev)
// double-invokes this effect — mount, cleanup, mount again, all before the
// first paint. The old `mounted` ref guard was meant to stop the
// animation restarting on that second invocation, but it did the opposite:
// the FIRST invocation's `requestAnimationFrame` loop gets cancelled by
// Strict Mode's synthetic cleanup before it ever ticks, and the guard then
// stopped the SECOND (real, lasting) invocation from starting a fresh one
// — so `display` never left its initial 0. Removing the guard fixes it:
// the first (cancelled) loop is harmless, and the second invocation's loop
// runs uninterrupted to completion, same as it already does in a
// production build (where Strict Mode's double-invoke doesn't happen).
export function StatValue({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
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
  }, [value]);

  return <>{display}</>;
}
