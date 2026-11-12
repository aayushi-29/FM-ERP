import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, ForbiddenError } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Admin-only: mark a data subject request Fulfilled or Declined once it's
// actually been handled outside this system (the export sent, the account
// deactivated/anonymized). This route never performs the export or
// deletion itself — it's a record that a human did.
const schema = z.object({
  status: z.enum(["FULFILLED", "DECLINED"]),
  note: z.string().max(1000).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = schema.parse(json);

    const existing = await prisma.dataSubjectRequest.findUnique({ where: { id: params.id } });
    if (!existing) throw new ForbiddenError("Request not found");

    const updated = await prisma.$transaction(async (tx) => {
      const req = await tx.dataSubjectRequest.update({
        where: { id: params.id },
        data: {
          status: input.status,
          note: input.note ?? existing.note,
          resolvedAt: new Date(),
          resolvedById: actor.id,
        },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "data_request.resolved",
          targetType: "DataSubjectRequest",
          targetId: params.id,
          before: { status: existing.status },
          after: { status: input.status, note: input.note },
        },
        tx
      );
      return req;
    });

    return NextResponse.json({ request: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
