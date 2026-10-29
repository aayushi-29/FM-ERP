"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Polls rather than pushes — there's no websocket/SSE infra in this app, so
// a 30s interval is the simple, honest way to keep the unread count fresh
// without adding a new transport just for this. Mounted once in Shell, so
// every page gets the same bell.
//
// 29 Oct 2026 (fourth pass): confirmed with the user — clicking the bell
// should navigate to a dedicated Notifications page (where urgent and
// routine notifications are shown as separate sections, app/notifications)
// instead of opening this small dropdown. The dropdown's fetch-on-poll and
// unread-count badge stay; only the "open a popover" behavior is gone.
export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
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

  return (
    <Link
      href="/notifications"
      className="fm-notif-trigger"
      aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications"}
      style={{ display: "inline-flex", position: "relative" }}
    >
      🔔
      {unreadCount > 0 ? <span className="fm-notif-dot">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
    </Link>
  );
}
