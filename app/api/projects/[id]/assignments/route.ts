import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// ProjectAssignment is the single source of truth for "can this
// PROJECT_LEAD / NPD_EXECUTIVE see this project" (see lib/auth/rbac.ts).
// This is how an NPD Executive gets added to a project — the lead's own
// assignment is created automatically at project creation, but nobody else
// is on it until explicitly added here.
const assignSchema = z.object({ userId: z.string().cuid() });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    // Admin can assign anyone; a Project Lead can add people to a project
    // they're already on, but not one they aren't — assertProjectAccess
    // below enforces that.
    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    await assertProjectAccess(actor, params.id);

    const json = await request.json().catch(() => null);
    const input = assignSchema.parse(json);

    const user = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!user || !user.active) {
      return NextResponse.json({ error: "User not found or inactive" }, { status: 400 });
    }
    if (user.role !== "PROJECT_LEAD" && user.role !== "NPD_EXECUTIVE") {
      return NextResponse.json(
        { error: "Only Project Lead or NPD Executive accounts can be assigned to a project" },
        { status: 400 }
      );
    }

    const existing = await prisma.projectAssignment.findUnique({
      where: { userId_projectId: { userId: input.userId, projectId: params.id } },
    });
    if (existing) {
      return NextResponse.json({ error: "Already assigned" }, { status: 409 });
    }

    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.projectAssignment.create({
        data: { userId: input.userId, projectId: params.id },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "PROJECT_ASSIGNMENT_ADDED",
          targetType: "Project",
          targetId: params.id,
          after: { userId: input.userId, role: user.role },
        },
        tx
      );
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `${user.name} added to the project` },
        tx
      );
      return created;
    });

    return NextResponse.json({ assignment }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
