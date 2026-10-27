import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { assertClientOrgAccess } from "@/lib/crm/scope";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const updateOrgSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    await assertClientOrgAccess(user, params.id);

    const client = await prisma.clientOrganization.findUnique({
      where: { id: params.id },
      include: {
        contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
        projects: { select: { id: true, name: true, status: true } },
      },
    });

    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ client });
  } catch (err) {
    return errorResponse(err);
  }
}

// Renaming the org itself stays Admin-only, unlike contacts below —
// see the note in lib/crm/scope.ts on why that line is drawn there.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = updateOrgSchema.parse(json);

    const existing = await prisma.clientOrganization.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.clientOrganization.update({
        where: { id: params.id },
        data: { name: input.name },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "CLIENT_ORG_UPDATED",
          targetType: "ClientOrganization",
          targetId: params.id,
          before: { name: existing.name },
          after: { name: result.name },
        },
        tx
      );
      return result;
    });

    return NextResponse.json({ client: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
