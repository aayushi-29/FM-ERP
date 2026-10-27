import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { getVisibleClientOrgIds } from "@/lib/crm/scope";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Clients / CRM row (baseline §4): Admin full access, Project Lead
// assigned/authorized clients only, NPD Executive and Client no access.
const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
});

export async function GET() {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    const visible = await getVisibleClientOrgIds(user);

    const clients = await prisma.clientOrganization.findMany({
      where: visible === "ALL" ? undefined : { id: { in: visible } },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { projects: true, contacts: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ clients });
  } catch (err) {
    return errorResponse(err);
  }
}

// Creating a new organization is Admin-only — "assigned/authorized" for a
// Project Lead presumes the org already exists (see lib/crm/scope.ts).
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = createOrgSchema.parse(json);

    const org = await prisma.$transaction(async (tx) => {
      const created = await tx.clientOrganization.create({ data: { name: input.name } });
      await logAudit(
        {
          actorId: actor.id,
          action: "CLIENT_ORG_CREATED",
          targetType: "ClientOrganization",
          targetId: created.id,
          after: { name: created.name },
        },
        tx
      );
      return created;
    });

    return NextResponse.json({ client: org }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
