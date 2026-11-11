import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { revokeAllSessionsForUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";
import { isPrimaryAdmin } from "@/lib/auth/super-admin";

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

// Permanent delete — distinct from PATCH { active: false } above, which is
// what offboarding normally means (Decision #9) and what every Admin can
// already do. This hard-deletes the row, so it's restricted to one named
// Admin account (see lib/auth/super-admin.ts) and blocked outright for a
// user who has any related records, rather than silently cascading through
// a real company's invoices, approvals, or audit history to make room for
// it — someone with real financial/approval history should be deactivated,
// not deleted.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);

    if (!isPrimaryAdmin(actor.email)) {
      return NextResponse.json(
        { error: "Only the primary Admin account can permanently delete a user" },
        { status: 403 }
      );
    }

    if (actor.id === params.id) {
      return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (target.role === "ADMIN") {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: "ADMIN", active: true, id: { not: target.id } },
      });
      if (otherActiveAdmins === 0) {
        return NextResponse.json(
          { error: "Can't delete the last active Admin — create or promote another Admin first" },
          { status: 409 }
        );
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.user.delete({ where: { id: target.id } });

        // targetId is a plain string column on AuditLog, not a foreign
        // key, so this row survives the user it describes being gone —
        // that's the point of an audit log entry for a deletion.
        await logAudit(
          {
            actorId: actor.id,
            action: "USER_DELETED",
            targetType: "User",
            targetId: target.id,
            before: { email: target.email, name: target.name, role: target.role },
            after: null,
          },
          tx
        );
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === "P2003" || err.code === "P2014")) {
        return NextResponse.json(
          {
            error:
              "This user has related records (projects led, approvals, invoices, audit history, etc.) and can't be permanently deleted without losing that history. Deactivate them instead to revoke access while keeping the records intact.",
          },
          { status: 409 }
        );
      }
      throw err;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
