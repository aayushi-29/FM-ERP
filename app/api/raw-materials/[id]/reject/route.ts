import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canApproveMaterials } from "@/lib/inventory/scope";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

const rejectSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});

// 29 Oct 2026 (fourth pass): materials-approval workflow, confirmed with
// the user. A rejected material stays in the catalog (not deleted — the
// NPD Executive who submitted it, and the Lead/Admin reviewing it, both
// benefit from the record staying visible with its reason), but it's
// still blocked from ingredient-line use the same as PENDING (the
// ingredient-lines route only allows APPROVED).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canApproveMaterials(actor.role)) throw new ForbiddenError("Not permitted");

    const material = await prisma.rawMaterial.findUnique({ where: { id: params.id } });
    if (!material) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (material.approvalStatus === "REJECTED") {
      throw new ValidationError("This material is already rejected");
    }

    const json = await request.json().catch(() => ({}));
    const input = rejectSchema.parse(json ?? {});

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.rawMaterial.update({
        where: { id: params.id },
        data: {
          approvalStatus: "REJECTED",
          approvedById: actor.id,
          approvedAt: new Date(),
          rejectionReason: input.reason ?? null,
        },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "raw_material.rejected",
          targetType: "RawMaterial",
          targetId: params.id,
          before: { approvalStatus: material.approvalStatus },
          after: { approvalStatus: "REJECTED", reason: input.reason },
        },
        tx
      );
      if (material.createdById) {
        await notifyUsers(
          [material.createdById],
          {
            type: "raw_material.rejected",
            message: `${actor.name} rejected your raw material "${result.name}"${input.reason ? `: ${input.reason}` : "."}`,
            link: "/raw-materials",
          },
          tx
        );
      }
      return result;
    });

    return NextResponse.json({ rawMaterial: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
