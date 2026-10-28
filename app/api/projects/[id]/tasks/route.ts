import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { logProjectActivity } from "@/lib/projects/activity";
import { assertDueDateWithinProject } from "@/lib/projects/due-date";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Tasks are internal work breakdown — Client has no access here at all
// (baseline §4: Client's row is "own projects; approved fields", and tasks
// aren't an approved field — see lib/projects/scope.ts for the same call
// on the Project read itself).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);
    await assertProjectAccess(user, params.id);

    const tasks = await prisma.task.findMany({
      where: { projectId: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        dependsOnId: true,
        assignee: { select: { id: true, name: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ tasks });
  } catch (err) {
    return errorResponse(err);
  }
}

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  assigneeId: z.string().cuid().optional(),
  dueDate: z.string().datetime().optional(),
  dependsOnId: z.string().cuid().optional(),
});

// Admin / Project Lead only (baseline §4: Project Lead "manages tasks";
// NPD Executive's row only gives it "assigned tasks/projects" — read and
// self-update, not creation. See PATCH in [id]/route.ts for that boundary.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    await assertProjectAccess(actor, params.id);

    const json = await request.json().catch(() => null);
    const input = createTaskSchema.parse(json);

    if (input.assigneeId) {
      const assignment = await prisma.projectAssignment.findUnique({
        where: { userId_projectId: { userId: input.assigneeId, projectId: params.id } },
      });
      if (!assignment) {
        return NextResponse.json(
          { error: "assigneeId must be assigned to this project first" },
          { status: 400 }
        );
      }
    }

    if (input.dependsOnId) {
      const dependsOn = await prisma.task.findUnique({ where: { id: input.dependsOnId } });
      if (!dependsOn || dependsOn.projectId !== params.id) {
        return NextResponse.json({ error: "dependsOnId must be a task in the same project" }, { status: 400 });
      }
    }

    if (input.dueDate) {
      await assertDueDateWithinProject(new Date(input.dueDate), params.id);
    }

    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          projectId: params.id,
          title: input.title,
          description: input.description,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          dependsOnId: input.dependsOnId,
        },
      });
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `Task created: ${created.title}` },
        tx
      );
      return created;
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
