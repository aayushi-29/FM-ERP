import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForTrial, assertFound } from "@/lib/npd/scope";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);
    const projectId = assertFound(await getProjectIdForTrial(params.id), "Not found");
    await assertProjectAccess(user, projectId);

    const trial = await prisma.trial.findUnique({
      where: { id: params.id },
      include: { attachments: { include: { document: { select: { id: true, type: true } } } } },
    });
    if (!trial) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ trial });
  } catch (err) {
    return errorResponse(err);
  }
}

const updateTrialSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETE"]).optional(),
  parameters: z.string().max(4000).nullable().optional(),
  results: z.string().max(4000).nullable().optional(),
  reviewerNotes: z.string().max(2000).nullable().optional(),
  materialLotUsed: z.string().max(200).nullable().optional(),
  quantityConsumed: z.string().regex(/^\d+(\.\d+)?$/).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "NPD_EXECUTIVE"]);
    const trial = await prisma.trial.findUnique({ where: { id: params.id } });
    if (!trial) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectId = assertFound(await getProjectIdForTrial(params.id), "Not found");
    await assertProjectAccess(actor, projectId);

    // "Create/update assigned trials" (baseline §4) — an NPD Executive may
    // only update a trial they themselves conducted; reviewerNotes is the
    // one exception, reserved for Admin/Project Lead feedback, but Project
    // Lead has no write access to this route at all per the matrix, so in
    // practice only Admin can set it today.
    const input = updateTrialSchema.parse(await request.json().catch(() => null));

    if (actor.role === "NPD_EXECUTIVE") {
      if (trial.conductedById !== actor.id) {
        throw new ForbiddenError("You can only update trials you conducted");
      }
      if (input.reviewerNotes !== undefined) {
        throw new ForbiddenError("Only an Admin can set reviewer notes");
      }
    }

    const updated = await prisma.trial.update({ where: { id: params.id }, data: input });
    return NextResponse.json({ trial: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
