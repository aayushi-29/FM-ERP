import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canReadCosting, canManageCosting } from "@/lib/costing/scope";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { notify } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadCosting(user.role)) throw new ForbiddenError("Not permitted");

    const costSheet = await prisma.costSheet.findUnique({
      where: { id: params.id },
      include: {
        formulationVersion: { select: { id: true, versionNumber: true, formulation: { select: { name: true } } } },
        createdBy: { select: { id: true, name: true } },
        supersedes: { select: { id: true, createdAt: true, costPerUnit: true } },
        supersededBy: { select: { id: true, createdAt: true, costPerUnit: true } },
      },
    });
    if (!costSheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(user, costSheet.projectId);

    return NextResponse.json({ costSheet });
  } catch (err) {
    return errorResponse(err);
  }
}

// 29 Oct 2026 (second pass): MRP visibility. recommendedMrp is a separate,
// Admin-entered final price — setting it never touches any of the cost
// breakdown fields. publish/unpublish only flips mrpPublishedAt; it never
// changes canReadCosting, so a Client still has zero direct access to this
// CostSheet record — the client-facing project page instead reads ONLY
// recommendedMrp (when published) through its own, separate query. See
// docs/decisions.md.
const updateMrpSchema = z.object({
  recommendedMrp: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  publish: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageCosting(actor.role)) throw new ForbiddenError("Only an Admin can set the MRP");

    const costSheet = await prisma.costSheet.findUnique({ where: { id: params.id } });
    if (!costSheet) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, costSheet.projectId);

    const input = updateMrpSchema.parse(await request.json().catch(() => null));

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.costSheet.update({
        where: { id: params.id },
        data: {
          recommendedMrp: input.recommendedMrp,
          mrpPublishedAt:
            input.publish === true ? new Date() : input.publish === false ? null : undefined,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "cost_sheet.mrp_updated",
          targetType: "CostSheet",
          targetId: result.id,
          after: { recommendedMrp: result.recommendedMrp?.toString(), published: !!result.mrpPublishedAt },
        },
        tx
      );
      await logProjectActivity(
        {
          projectId: costSheet.projectId,
          actorId: actor.id,
          summary: result.mrpPublishedAt
            ? `MRP published to client: ${result.recommendedMrp?.toString()} ${costSheet.currency}`
            : `MRP updated`,
        },
        tx
      );
      if (input.publish === true) {
        await notify(
          {
            projectId: costSheet.projectId,
            audience: "client",
            type: "mrp.published",
            message: `An MRP of ${result.recommendedMrp?.toString()} ${costSheet.currency} is now available on your project.`,
            link: `/projects/${costSheet.projectId}`,
          },
          tx
        );
      }

      return result;
    });

    return NextResponse.json({ costSheet: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
