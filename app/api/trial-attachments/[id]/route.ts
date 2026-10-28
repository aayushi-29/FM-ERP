import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForTrial, assertFound } from "@/lib/npd/scope";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Removes the join row only — never the underlying Document, which may
// still be referenced elsewhere or simply belongs to the project
// independent of this trial. Same write rule as creating the attachment.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "NPD_EXECUTIVE"]);
    const attachment = await prisma.trialAttachment.findUnique({
      where: { id: params.id },
      include: { trial: true },
    });
    if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectId = assertFound(await getProjectIdForTrial(attachment.trialId), "Not found");
    await assertProjectAccess(actor, projectId);

    if (actor.role === "NPD_EXECUTIVE" && attachment.trial.conductedById !== actor.id) {
      throw new ForbiddenError("You can only remove attachments from trials you conducted");
    }

    await prisma.trialAttachment.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
