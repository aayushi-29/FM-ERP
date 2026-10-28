import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { logProjectActivity } from "@/lib/projects/activity";
import { assertDueDateWithinProject } from "@/lib/projects/due-date";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const TASK_STATUS_VALUES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

const fullUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  assigneeId: z.string().cuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

// NPD Executive's row (baseline §4) only grants "assigned tasks/projects" —
// read, plus moving their own task's status. They can't retitle it,
// reassign it, or touch anyone else's task.
const selfStatusSchema = z.object({ status: z.enum(TASK_STATUS_VALUES) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    // CLIENT excluded entirely at the role check — not even a scoped read.
    const actor = await requireRole(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);

    const task = await prisma.task.findUnique({ where: { id: params.id } });
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(actor, task.projectId);

    const json = await request.json().catch(() => null);

    if (actor.role === "NPD_EXECUTIVE") {
      if (task.assigneeId !== actor.id) {
        throw new ForbiddenError("You can only update tasks assigned to you");
      }
      const input = selfStatusSchema.parse(json);
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.task.update({ where: { id: params.id }, data: { status: input.status } });
        await logProjectActivity(
          { projectId: task.projectId, actorId: actor.id, summary: `${task.title}: status -> ${input.status}` },
          tx
        );
        return result;
      });
      return NextResponse.json({ task: updated });
    }

    // ADMIN / PROJECT_LEAD: full field set.
    const input = fullUpdateSchema.parse(json);

    if (input.assigneeId) {
      const assignment = await prisma.projectAssignment.findUnique({
        where: { userId_projectId: { userId: input.assigneeId, projectId: task.projectId } },
      });
      if (!assignment) {
        return NextResponse.json(
          { error: "assigneeId must be assigned to this project first" },
          { status: 400 }
        );
      }
    }

    if (input.dueDate) {
      await assertDueDateWithinProject(new Date(input.dueDate), task.projectId);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.task.update({
        where: { id: params.id },
        data: {
          title: input.title,
          description: input.description,
          status: input.status,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate === null ? null : input.dueDate ? new Date(input.dueDate) : undefined,
        },
      });

      if (input.status && input.status !== task.status) {
        await logProjectActivity(
          { projectId: task.projectId, actorId: actor.id, summary: `${result.title}: status -> ${input.status}` },
          tx
        );
      }
      if (input.assigneeId !== undefined && input.assigneeId !== task.assigneeId) {
        await logProjectActivity(
          { projectId: task.projectId, actorId: actor.id, summary: `${result.title}: reassigned` },
          tx
        );
      }

      return result;
    });

    return NextResponse.json({ task: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
