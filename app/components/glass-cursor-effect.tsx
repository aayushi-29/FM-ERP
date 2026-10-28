"use client";

import { useEffect } from "react";

// Makes every .glass panel's sheen (see globals.css, .glass::after) follow
// the pointer instead of sitting at a fixed spot. One delegated listener
// for the whole app rather than a handler per card — cheap, and it still
// works on cards rendered after this mounts since it reads the DOM at
// move-time via closest(), not a fixed list collected on mount.
export function GlassCursorEffect() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pending: PointerEvent | null = null;
    let raf = 0;

    function apply() {
      raf = 0;
      const e = pending;
      pending = null;
      if (!e) return;

      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(".glass");
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      target.style.setProperty("--mx", `${x}%`);
      target.style.setProperty("--my", `${y}%`);
    }

    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse") return; // touch devices don't hover
      pending = e;
      if (!raf) raf = requestAnimationFrame(apply);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
