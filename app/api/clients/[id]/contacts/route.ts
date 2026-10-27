import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { assertClientOrgAccess } from "@/lib/crm/scope";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const createContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().min(1).max(50).optional(),
  isPrimary: z.boolean().optional(),
});

// Contacts are the one CRM sub-resource a scoped Project Lead can manage,
// not just read — see lib/crm/scope.ts for why.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    await assertClientOrgAccess(actor, params.id);

    const json = await request.json().catch(() => null);
    const input = createContactSchema.parse(json);

    const org = await prisma.clientOrganization.findUnique({ where: { id: params.id } });
    if (!org) return NextResponse.json({ error: "Client organization not found" }, { status: 404 });

    const contact = await prisma.$transaction(async (tx) => {
      // Only one primary contact per org — demote any existing one rather
      // than ending up with two, if this new contact is marked primary.
      if (input.isPrimary) {
        await tx.clientContact.updateMany({
          where: { clientOrgId: params.id, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      const created = await tx.clientContact.create({
        data: {
          clientOrgId: params.id,
          name: input.name,
          email: input.email,
          phone: input.phone,
          isPrimary: input.isPrimary ?? false,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "CLIENT_CONTACT_CREATED",
          targetType: "ClientContact",
          targetId: created.id,
          after: { clientOrgId: params.id, name: created.name, email: created.email },
        },
        tx
      );

      return created;
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
