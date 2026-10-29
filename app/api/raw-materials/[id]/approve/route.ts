import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canApproveMaterials } from "@/lib/inventory/scope";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// 29 Oct 2026 (fourth pass): materials-approval workflow, confirmed with
// the user — a Project Lead (or Admin) accepting a material an NPD
// Executive submitted. Admin can also approve its own/another Admin's
// already-APPROVED material again (a no-op beyond re-stamping who/when) —
// not worth a special-case rejection for that, since it's harmless.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canApproveMaterials(actor.role)) throw new ForbiddenError("Not permitted");

    const material = await prisma.rawMaterial.findUnique({ where: { id: params.id } });
    if (!material) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (material.approvalStatus === "APPROVED") {
      throw new ValidationError("This material is already approved");
    }

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.rawMaterial.update({
        where: { id: params.id },
        data: {
          approvalStatus: "APPROVED",
          approvedById: actor.id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "raw_material.approved",
          targetType: "RawMaterial",
          targetId: params.id,
          before: { approvalStatus: material.approvalStatus },
          after: { approvalStatus: "APPROVED" },
        },
        tx
      );
      if (material.createdById) {
        await notifyUsers(
          [material.createdById],
          {
            type: "raw_material.approved",
            message: `${actor.name} approved your raw material "${result.name}" — it's now available to use.`,
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
