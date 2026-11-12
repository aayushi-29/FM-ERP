import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { notifyRoleWide } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Any signed-in user (staff or client) can ask for a copy of their data or
// for their account to be deleted. This route only records the request and
// tells Admin about it — it deliberately does NOT auto-export or
// auto-delete anything; see app/admin/data-requests/page.tsx for the
// manual, audited fulfillment side.
const createSchema = z.object({
  type: z.enum(["EXPORT", "DELETE"]),
  note: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    const json = await request.json().catch(() => null);
    const input = createSchema.parse(json);

    const created = await prisma.$transaction(async (tx) => {
      const req = await tx.dataSubjectRequest.create({
        data: { userId: actor.id, type: input.type, note: input.note },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: input.type === "EXPORT" ? "data_request.export_requested" : "data_request.delete_requested",
          targetType: "DataSubjectRequest",
          targetId: req.id,
          after: { type: input.type, note: input.note },
        },
        tx
      );
      return req;
    });

    await notifyRoleWide(["ADMIN"], {
      type: "data_request",
      message:
        input.type === "EXPORT"
          ? `${actor.name} requested a copy of their data.`
          : `${actor.name} requested account/data deletion.`,
      link: "/admin/data-requests",
      urgent: true,
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function GET() {
  try {
    const actor = await requireUser();
    const requests = await prisma.dataSubjectRequest.findMany({
      where: { userId: actor.id },
      orderBy: { requestedAt: "desc" },
    });
    return NextResponse.json({ requests });
  } catch (err) {
    return errorResponse(err);
  }
}
