import Link from "next/link";
import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/app/components/shell";
import { NotificationFeed } from "./notification-feed";

export const metadata: Metadata = { title: "Notifications" };

// 29 Oct 2026 (fourth pass): confirmed with the user — clicking the bell
// icon should land here instead of opening the small dropdown, and urgent
// (needs-your-action) notifications should be visually separated from
// routine/common ones rather than mixed into one flat list. Every role can
// read its own notifications — same scoping rule as GET /api/notifications
// (recipientId === caller is the only access check that applies).
export default async function NotificationsPage() {
  const user = await requireUserOrRedirect();

  const [urgent, regular] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id, urgent: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.notification.findMany({
      where: { recipientId: user.id, urgent: false },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const serialize = (n: (typeof urgent)[number]) => ({
    id: n.id,
    message: n.message,
    link: n.link,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  });

  return (
    <Shell user={user}>
      <nav className="fm-breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span>/</span>
        <span>Notifications</span>
      </nav>
      <div className="fm-page-head">
        <h1>Notifications</h1>
        <p>Items that need your action are kept separate from routine updates.</p>
      </div>

      <NotificationFeed urgent={urgent.map(serialize)} regular={regular.map(serialize)} />
    </Shell>
  );
}
