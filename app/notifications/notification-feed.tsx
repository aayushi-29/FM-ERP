"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

// 29 Oct 2026 (fourth pass): fixed a hydration-mismatch crash reported on
// this page — Date#toLocaleString() with no explicit locale uses the
// *environment's* default locale/format, which differs between the Node
// server (e.g. "10/29/2026, 9:21:34 PM") and the viewer's browser (e.g.
// "29/10/2026, 21:21:34" for an India-formatted browser) — React then
// throws because the server-rendered HTML doesn't match what the client
// render produces. Rendering `null` on first paint (same on server and
// client, since no effect has run yet) and filling in the formatted string
// from a useEffect avoids ever calling toLocaleString() during SSR at all.
function FormattedTime({ iso }: { iso: string }) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(new Date(iso).toLocaleString());
  }, [iso]);
  return <span className="fm-li-meta">{text}</span>;
}

// 29 Oct 2026 (fourth pass): confirmed with the user — "see common and
// important notification as segregated" when they click the bell, instead
// of one flat list. `urgent`/`regular` are two already-split arrays from
// the server (app/notifications/page.tsx); this just handles the
// interactive bits (mark one read on click-through, mark all read) that a
// Server Component can't do itself.
export function NotificationFeed({
  urgent,
  regular,
}: {
  urgent: NotificationItem[];
  regular: NotificationItem[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const anyUnread = [...urgent, ...regular].some((n) => !n.isRead);

  async function markOneRead(id: string) {
    setPendingId(id);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      router.refresh();
    } finally {
      setMarkingAll(false);
    }
  }

  function Item({ n }: { n: NotificationItem }) {
    const content = (
      <>
        <span>{n.message}</span>
        <FormattedTime iso={n.createdAt} />
      </>
    );
    return (
      <li className={n.isRead ? "fm-notif-feed-item" : "fm-notif-feed-item fm-notif-feed-item-unread"}>
        {n.link ? (
          <a href={n.link} onClick={() => markOneRead(n.id)}>
            {content}
          </a>
        ) : (
          <span onClick={() => markOneRead(n.id)} style={{ cursor: "pointer" }}>
            {content}
          </span>
        )}
        {!n.isRead && pendingId !== n.id ? <span className="fm-badge fm-badge-warn">Unread</span> : null}
      </li>
    );
  }

  return (
    <>
      {anyUnread ? (
        <div style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={markAllRead}
            disabled={markingAll}
            className="fm-entity-card-cta fm-notif-markall-btn"
          >
            {markingAll ? "…" : "Mark all as read"}
          </button>
        </div>
      ) : null}

      <div className="fm-section-grid">
        <div className="glass glass-sm glass-card fm-section">
          <h3>Needs your action</h3>
          {urgent.length === 0 ? (
            <p className="fm-empty">Nothing needs your attention right now.</p>
          ) : (
            <ul className="fm-notif-feed-list">
              {urgent.map((n) => (
                <Item key={n.id} n={n} />
              ))}
            </ul>
          )}
        </div>

        <div className="glass glass-sm glass-card fm-section">
          <h3>Updates</h3>
          {regular.length === 0 ? (
            <p className="fm-empty">Nothing here right now.</p>
          ) : (
            <ul className="fm-notif-feed-list">
              {regular.map((n) => (
                <Item key={n.id} n={n} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
