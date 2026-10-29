import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { assertDueDateWithinProject } from "@/lib/projects/due-date";
import { assertExecutionUnlocked } from "@/lib/projects/execution-gate";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Three distinct transition rights, matching the baseline §4 Milestones row
// exactly — this is the one place in the app where the schema's status
// enum alone doesn't say who may move it:
//   Project Lead: edit the milestone, and request approval
//                 (PENDING -> SUBMITTED). Can't self-approve.
//   Client:       decide a submitted milestone (SUBMITTED -> APPROVED or
//                 REJECTED). Can't touch anything still PENDING.
//   Admin:        override — any status, any time ("manage where
//                 authorized"). Every decision either role makes is
//                 audited; a Project Lead editing their own PENDING
//                 milestone is routine and isn't.
const leadEditSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  requestApproval: z.boolean().optional(), // true => PENDING -> SUBMITTED
});

const clientDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});

const adminOverrideSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(["PENDING", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD", "CLIENT"]);

    const milestone = await prisma.milestone.findUnique({ where: { id: params.id } });
    if (!milestone) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(actor, milestone.projectId);
    // 29 Oct 2026 (third pass): confirmed with the user — no milestone
    // edit (Project Lead editing/submitting, Client approving/rejecting,
    // or Admin's override) until the 60% advance is verified. Applied
    // uniformly across all three branches below rather than per-role,
    // since in practice a SUBMITTED milestone can't exist pre-advance
    // anyway once creation is gated (see the milestones POST route) — this
    // just keeps every path consistent and defends against edge cases
    // (e.g. a milestone created before the gate existed).
    await assertExecutionUnlocked(milestone.projectId);

    const json = await request.json().catch(() => null);

    if (actor.role === "CLIENT") {
      if (milestone.status !== "SUBMITTED") {
        throw new ForbiddenError("This milestone isn't awaiting your approval yet");
      }
      const input = clientDecisionSchema.parse(json);

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.milestone.update({
          where: { id: params.id },
          data: { status: input.decision },
        });
        await logAudit(
          {
            actorId: actor.id,
            action: `MILESTONE_${input.decision}`,
            targetType: "Milestone",
            targetId: params.id,
            before: { status: milestone.status },
            after: { status: input.decision },
          },
          tx
        );
        await logProjectActivity(
          { projectId: milestone.projectId, actorId: actor.id, summary: `${milestone.title}: client ${input.decision.toLowerCase()}` },
          tx
        );
        return result;
      });

      return NextResponse.json({ milestone: updated });
    }

    if (actor.role === "PROJECT_LEAD") {
      if (milestone.status !== "PENDING") {
        throw new ForbiddenError("Only a PENDING milestone can be edited or submitted for approval");
      }
      const input = leadEditSchema.parse(json);

      if (input.dueDate) {
        await assertDueDateWithinProject(new Date(input.dueDate), milestone.projectId);
      }

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.milestone.update({
          where: { id: params.id },
          data: {
            title: input.title,
            dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
            status: input.requestApproval ? "SUBMITTED" : undefined,
          },
        });
        if (input.requestApproval) {
          await logProjectActivity(
            { projectId: milestone.projectId, actorId: actor.id, summary: `${result.title}: submitted for client approval` },
            tx
          );
        }
        return result;
      });

      return NextResponse.json({ milestone: updated });
    }

    // ADMIN override.
    const input = adminOverrideSchema.parse(json);

    if (input.dueDate) {
      await assertDueDateWithinProject(new Date(input.dueDate), milestone.projectId);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.milestone.update({
        where: { id: params.id },
        data: {
          title: input.title,
          dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
          status: input.status,
        },
      });
      if (input.status && input.status !== milestone.status) {
        await logAudit(
          {
            actorId: actor.id,
            action: "MILESTONE_ADMIN_OVERRIDE",
            targetType: "Milestone",
            targetId: params.id,
            before: { status: milestone.status },
            after: { status: input.status },
          },
          tx
        );
      }
      return result;
    });

    return NextResponse.json({ milestone: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
