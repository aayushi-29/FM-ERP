"use client";

import { useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

// Polls rather than pushes — there's no websocket/SSE infra in this app, so
// a 30s interval is the simple, honest way to keep the unread count fresh
// without adding a new transport just for this. Mounted once in Shell, so
// every page gets the same bell.
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // Silent — a failed poll just leaves the last-known count visible.
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // Best-effort — next poll reconciles if this failed.
    }
  }

  async function markOneRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Best-effort — next poll reconciles if this failed.
    }
  }

  return (
    <div ref={containerRef} className="fm-notif" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fm-notif-trigger"
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
      >
        🔔
        {unreadCount > 0 ? <span className="fm-notif-dot">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="fm-notif-panel glass glass-strong glass-card">
          <div className="fm-notif-panel-head">
            <span>Notifications</span>
            {unreadCount > 0 ? (
              <button type="button" onClick={markAllRead} className="fm-notif-markall">
                Mark all read
              </button>
            ) : null}
          </div>
          {notifications.length === 0 ? (
            <p className="fm-empty">No notifications yet.</p>
          ) : (
            <ul className="fm-notif-list">
              {notifications.map((n) => (
                <li key={n.id} className={n.isRead ? "fm-notif-item" : "fm-notif-item fm-notif-item-unread"}>
                  {n.link ? (
                    <a href={n.link} onClick={() => markOneRead(n.id)}>
                      {n.message}
                    </a>
                  ) : (
                    <span onClick={() => markOneRead(n.id)}>{n.message}</span>
                  )}
                  <span className="fm-notif-time">{new Date(n.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
