import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { logProjectActivity } from "@/lib/projects/activity";
import { assertDueDateWithinProject } from "@/lib/projects/due-date";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Milestones row (baseline §4): Admin manage where authorized, Project
// Lead create/manage + request approval, NPD Executive NO ACCESS (excluded
// at the role check below, not just scoped out), Client approve/reject
// designated milestones — so Client needs read access here too, unlike
// Tasks.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD", "CLIENT"]);
    await assertProjectAccess(user, params.id);

    const milestones = await prisma.milestone.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ milestones });
  } catch (err) {
    return errorResponse(err);
  }
}

const createMilestoneSchema = z.object({
  title: z.string().min(1).max(200),
  dueDate: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    await assertProjectAccess(actor, params.id);

    const json = await request.json().catch(() => null);
    const input = createMilestoneSchema.parse(json);

    if (input.dueDate) {
      await assertDueDateWithinProject(new Date(input.dueDate), params.id);
    }

    const milestone = await prisma.$transaction(async (tx) => {
      const created = await tx.milestone.create({
        data: {
          projectId: params.id,
          title: input.title,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        },
      });
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `Milestone added: ${created.title}` },
        tx
      );
      return created;
    });

    return NextResponse.json({ milestone }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
