import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { logAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Baseline §4 permission matrix, Formulations row: "Project Lead: Review/
// approve", "Admin: Manage; final approval if authorized" — both roles can
// decide. NPD Executive's row is "Create drafts; revise; submit" — it does
// not include approving its own submission, so it's excluded here even
// though it can touch the same record elsewhere.
const decideSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(actor, projectId);

    const version = await prisma.formulationVersion.findUnique({ where: { id: params.id } });
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (version.status !== "IN_REVIEW") {
      throw new ForbiddenError(
        version.status === "DRAFT"
          ? "This version hasn't been submitted for review yet"
          : "This version has already been decided"
      );
    }

    const json = await request.json().catch(() => null);
    const input = decideSchema.parse(json);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.formulationVersion.update({
        where: { id: params.id },
        data: { status: input.decision, decidedAt: new Date() },
      });

      const approval = await tx.approval.create({
        data: {
          formulationVersionId: params.id,
          approverId: actor.id,
          decision: input.decision,
          comment: input.comment,
        },
      });

      // Baseline §10: "approvals need an audit trail" — recorded in
      // AuditLog (compliance-grade, append-only) in addition to the
      // lighter ProjectActivity feed entry below.
      await logAudit(
        {
          actorId: actor.id,
          action: `formulation_version.${input.decision.toLowerCase()}`,
          targetType: "FormulationVersion",
          targetId: params.id,
          before: { status: version.status },
          after: { status: input.decision, approvalId: approval.id, comment: input.comment },
        },
        tx
      );

      await logProjectActivity(
        {
          projectId,
          actorId: actor.id,
          summary: `Formulation v${updated.versionNumber} ${input.decision.toLowerCase()}`,
        },
        tx
      );

      // 29 Oct 2026 (fourth pass): this route previously sent no
      // notification at all — the author only found out by checking the
      // page. Confirmed with the user: tell the specific author directly
      // (not a role-wide broadcast), and flag a rejection urgent since it
      // needs them to revise and resubmit, same treatment as a rejected
      // payment claim or raw material.
      await notifyUsers(
        [version.authorId],
        {
          type: `formulation_version.${input.decision.toLowerCase()}`,
          message:
            input.decision === "REJECTED"
              ? `Your formulation version v${updated.versionNumber} was rejected${input.comment ? `: ${input.comment}` : "."} Revise and resubmit.`
              : `Your formulation version v${updated.versionNumber} was approved.`,
          link: `/formulation-versions/${params.id}`,
          urgent: input.decision === "REJECTED",
        },
        tx
      );

      return { version: updated, approval };
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
