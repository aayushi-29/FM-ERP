"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { label: string; href: string; hint?: string; keywords?: string };

const ITEMS: Item[] = [
  { label: "Dashboard", href: "/dashboard", hint: "Your role's landing view" },
  { label: "Leads", href: "/leads", hint: "Sales pipeline", keywords: "crm prospect convert" },
  { label: "Clients", href: "/clients", hint: "Client organizations" },
  { label: "Projects", href: "/projects", hint: "All projects" },
  { label: "New project", href: "/projects/new", keywords: "create add" },
  { label: "Users", href: "/admin/users", hint: "Admin only", keywords: "team accounts roles" },
  { label: "Audit log", href: "/admin/audit-log", hint: "Admin only", keywords: "history activity log" },
];

// A global quick-nav, the kind any modern internal tool ships: press
// Cmd/Ctrl+K anywhere to jump to a page without hunting through the nav.
// Mounted once in the root layout so it's available on every screen.
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ITEMS;
    return ITEMS.filter((it) => `${it.label} ${it.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[index];
      if (item) go(item.href);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="fm-cmdk-trigger fm-btn-ghost"
        onClick={() => setOpen(true)}
        aria-label="Open quick navigation"
        title="Quick navigation (⌘K)"
      >
        <span aria-hidden="true">⌘</span>K
      </button>
    );
  }

  return (
    <div className="fm-cmdk-overlay" onClick={() => setOpen(false)} role="presentation">
      <div
        className="fm-cmdk glass glass-strong"
        role="dialog"
        aria-modal="true"
        aria-label="Quick navigation"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="Jump to…"
          className="fm-cmdk-input"
          aria-label="Search pages"
        />
        <ul className="fm-cmdk-list">
          {results.length === 0 ? (
            <li className="fm-cmdk-empty">No matching page.</li>
          ) : (
            results.map((item, i) => (
              <li key={item.href}>
                <button
                  type="button"
                  className={`fm-cmdk-item${i === index ? " fm-cmdk-item-active" : ""}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => go(item.href)}
                >
                  <span>{item.label}</span>
                  {item.hint ? <span className="fm-cmdk-hint">{item.hint}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
