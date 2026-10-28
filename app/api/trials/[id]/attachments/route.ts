import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForTrial, assertFound } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// Links an already-uploaded project Document to a Trial (the schema's
// TrialAttachment join row — baseline §6.3 groups this under the Trials
// row, so it follows the same write rule as PATCH /api/trials/[id]: Admin
// always, an NPD Executive only for a trial they themselves conducted.
// This route never uploads a new file — attaching re-points an existing
// Document (created through the Documents module) at a trial; the file
// itself still goes through the usual upload route and its own
// type/visibility rules.
const attachSchema = z.object({
  documentId: z.string().cuid(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "NPD_EXECUTIVE"]);
    const trial = await prisma.trial.findUnique({ where: { id: params.id } });
    if (!trial) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectId = assertFound(await getProjectIdForTrial(params.id), "Not found");
    await assertProjectAccess(actor, projectId);

    if (actor.role === "NPD_EXECUTIVE" && trial.conductedById !== actor.id) {
      throw new ForbiddenError("You can only attach documents to trials you conducted");
    }

    const input = attachSchema.parse(await request.json().catch(() => null));

    const document = await prisma.document.findUnique({ where: { id: input.documentId } });
    if (!document) return NextResponse.json({ error: "documentId does not exist" }, { status: 400 });
    if (document.projectId !== projectId) {
      throw new ValidationError("That document belongs to a different project");
    }

    const existing = await prisma.trialAttachment.findFirst({
      where: { trialId: params.id, documentId: input.documentId },
    });
    if (existing) {
      throw new ValidationError("That document is already attached to this trial");
    }

    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.trialAttachment.create({
        data: { trialId: params.id, documentId: input.documentId },
      });
      await logProjectActivity(
        { projectId, actorId: actor.id, summary: `Document attached to trial` },
        tx
      );
      return created;
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
