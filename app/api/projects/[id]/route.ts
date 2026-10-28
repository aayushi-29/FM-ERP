import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, requireRole } from "@/lib/auth/rbac";
import { CLIENT_SAFE_PROJECT_SELECT } from "@/lib/projects/scope";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await assertProjectAccess(user, params.id);

    if (user.role === "CLIENT") {
      const project = await prisma.project.findUnique({
        where: { id: params.id },
        select: {
          ...CLIENT_SAFE_PROJECT_SELECT,
          milestones: { select: { id: true, title: true, dueDate: true, status: true } },
        },
      });
      if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ project });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        clientOrg: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true, email: true } },
        milestones: { orderBy: { createdAt: "asc" } },
        assignments: { include: { user: { select: { id: true, name: true, role: true } } } },
        _count: { select: { tasks: true } },
      },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}

// Admin-only, deliberately narrower than creation: no leadId here.
// Reassigning the lead changes who has access (a new ProjectAssignment
// row), which is a bigger operation than a field edit — left as a
// follow-up rather than folded silently into this PATCH.
const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
  scope: z.string().max(4000).optional(),
  targetDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = updateProjectSchema.parse(json);

    const existing = await prisma.project.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // The reverse of the task/milestone-side check: pulling the project's
    // own target date earlier can't be allowed to silently strand a task
    // or milestone that's already due after it — that's the same
    // inconsistency either direction, so it's rejected here too rather
    // than only guarded against on creation.
    if (input.targetDate) {
      const newTarget = new Date(input.targetDate);
      const [laterTask, laterMilestone] = await Promise.all([
        prisma.task.findFirst({ where: { projectId: params.id, dueDate: { gt: newTarget } }, select: { title: true } }),
        prisma.milestone.findFirst({ where: { projectId: params.id, dueDate: { gt: newTarget } }, select: { title: true } }),
      ]);
      const conflict = laterTask ?? laterMilestone;
      if (conflict) {
        throw new ValidationError(
          `Can't set the target date before "${conflict.title}", which is already due after it`
        );
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.project.update({
        where: { id: params.id },
        data: {
          name: input.name,
          status: input.status,
          scope: input.scope,
          targetDate: input.targetDate === null ? null : input.targetDate ? new Date(input.targetDate) : undefined,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "PROJECT_UPDATED",
          targetType: "Project",
          targetId: params.id,
          before: { name: existing.name, status: existing.status },
          after: { name: result.name, status: result.status },
        },
        tx
      );
      if (input.status && input.status !== existing.status) {
        await logProjectActivity(
          { projectId: params.id, actorId: actor.id, summary: `Status changed to ${input.status}` },
          tx
        );
      }

      return result;
    });

    return NextResponse.json({ project: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
