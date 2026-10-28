import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "PROJECT_LEAD"]);
    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (err) {
    return errorResponse(err);
  }
}

// Only QUALIFIED/LOST/notes move through here — CONVERTED is set
// exclusively by POST /api/leads/[id]/convert, which also has to create
// the ClientOrganization/Project in the same transaction, so a bare status
// write here could never do that. Rejecting CONVERTED on this route keeps
// that the only path, rather than two ways to reach the same state that
// could drift apart.
const updateLeadSchema = z.object({
  status: z.enum(["OPEN", "QUALIFIED", "LOST"]).optional(),
  notes: z.string().max(4000).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    const json = await request.json().catch(() => null);
    const input = updateLeadSchema.parse(json);

    const existing = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.status === "CONVERTED") {
      throw new ValidationError("A converted lead can't be edited — see its linked project instead");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.lead.update({
        where: { id: params.id },
        data: { status: input.status, notes: input.notes },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "LEAD_UPDATED",
          targetType: "Lead",
          targetId: result.id,
          before: { status: existing.status },
          after: { status: result.status },
        },
        tx
      );
      return result;
    });

    return NextResponse.json({ lead: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
