import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { getVisibleProjectIds, CLIENT_SAFE_PROJECT_SELECT } from "@/lib/projects/scope";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  clientOrgId: z.string().cuid(),
  leadId: z.string().cuid(),
  scope: z.string().max(4000).optional(),
  targetDate: z.string().datetime().optional(),
});

export async function GET() {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE", "CLIENT"]);
    const visible = await getVisibleProjectIds(user);
    const where = visible === "ALL" ? undefined : { id: { in: visible } };

    // Field-level DTO per role (baseline §4): a Client never receives the
    // same payload shape an Admin does, not just a filtered record list.
    if (user.role === "CLIENT") {
      const projects = await prisma.project.findMany({ where, select: CLIENT_SAFE_PROJECT_SELECT });
      return NextResponse.json({ projects });
    }

    const projects = await prisma.project.findMany({
      where,
      select: {
        id: true,
        name: true,
        status: true,
        targetDate: true,
        createdAt: true,
        clientOrg: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
        _count: { select: { tasks: true, milestones: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ projects });
  } catch (err) {
    return errorResponse(err);
  }
}

// Admin-only (baseline §4: Projects & tasks is "organization-wide" for
// Admin; neither Project Lead nor anyone else is listed as able to create
// one). Creating a project also creates the lead's ProjectAssignment row in
// the same transaction — that row, not the leadId field, is what actually
// grants access (lib/auth/rbac.ts's assertProjectAccess checks it), so the
// two can never drift out of sync.
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = createProjectSchema.parse(json);

    const [clientOrg, lead] = await Promise.all([
      prisma.clientOrganization.findUnique({ where: { id: input.clientOrgId } }),
      prisma.user.findUnique({ where: { id: input.leadId } }),
    ]);
    if (!clientOrg) {
      return NextResponse.json({ error: "clientOrgId does not exist" }, { status: 400 });
    }
    if (!lead || lead.role !== "PROJECT_LEAD" || !lead.active) {
      return NextResponse.json(
        { error: "leadId must be an active user with the Project Lead role" },
        { status: 400 }
      );
    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: input.name,
          clientOrgId: input.clientOrgId,
          leadId: input.leadId,
          scope: input.scope,
          targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        },
      });

      await tx.projectAssignment.create({
        data: { userId: input.leadId, projectId: created.id },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "PROJECT_CREATED",
          targetType: "Project",
          targetId: created.id,
          after: { name: created.name, clientOrgId: created.clientOrgId, leadId: created.leadId },
        },
        tx
      );
      await logProjectActivity(
        { projectId: created.id, actorId: actor.id, summary: `Project created, led by ${lead.name}` },
        tx
      );

      return created;
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
