import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { revokeAllSessionsForUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const ROLE_VALUES = ["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE", "CLIENT"] as const;

const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(ROLE_VALUES).optional(),
  active: z.boolean().optional(),
  clientOrgId: z.string().cuid().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = updateUserSchema.parse(json);

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const demotingAdmin = target.role === "ADMIN" && input.role && input.role !== "ADMIN";
    const deactivatingAdmin = target.role === "ADMIN" && input.active === false;

    if (demotingAdmin || deactivatingAdmin) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: "ADMIN", active: true, id: { not: target.id } },
      });
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: "Can't remove the last active Admin — create or promote another Admin first" },
          { status: 409 }
        );
      }
    }

    if (input.role === "CLIENT" && input.clientOrgId === undefined && !target.clientOrgId) {
      return NextResponse.json(
        { error: "clientOrgId is required when setting role to CLIENT" },
        { status: 400 }
      );
    }

    const before = { name: target.name, role: target.role, active: target.active, clientOrgId: target.clientOrgId };

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id: target.id },
        data: {
          name: input.name,
          role: input.role,
          active: input.active,
          clientOrgId: input.clientOrgId,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "USER_UPDATED",
          targetType: "User",
          targetId: target.id,
          before,
          after: { name: result.name, role: result.role, active: result.active, clientOrgId: result.clientOrgId },
        },
        tx
      );

      return result;
    });

    // Decision #9: offboarding (active -> false) revokes access immediately.
    // A role change also revokes sessions — the session's cached scope
    // shouldn't outlive the permission change that invalidated it.
    if (input.active === false || (input.role && input.role !== target.role)) {
      await revokeAllSessionsForUser(target.id);
    }

    return NextResponse.json({
      user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, active: updated.active },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
