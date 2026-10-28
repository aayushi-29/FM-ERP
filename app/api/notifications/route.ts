import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/rbac";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Every role can read its own notifications — there's no project-scoping
// check here because a Notification's recipientId already is the scope
// (lib/notifications.ts only ever writes rows for the right recipients).
export async function GET() {
  try {
    const user = await requireUser();

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({ where: { recipientId: user.id, isRead: false } }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return errorResponse(err);
  }
}

const patchSchema = z.union([
  z.object({ id: z.string().cuid() }),
  z.object({ all: z.literal(true) }),
]);

// Marks one notification (by id) or all of the current user's unread
// notifications as read. Scoped to recipientId === the caller — a user can
// never mark someone else's notification read, regardless of what id is
// posted.
export async function PATCH(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const user = await requireUser();
    const json = await request.json().catch(() => null);
    const input = patchSchema.parse(json);

    if ("all" in input) {
      await prisma.notification.updateMany({
        where: { recipientId: user.id, isRead: false },
        data: { isRead: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { id: input.id, recipientId: user.id },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
