import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canReadInventory, canManageInventory } from "@/lib/inventory/scope";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Suppliers aren't project-scoped (Decision #7: company-wide catalog, no
// ledger yet), so there's no assertProjectAccess check here — only the
// role check.
export async function GET() {
  try {
    const user = await requireUser();
    if (!canReadInventory(user.role)) throw new ForbiddenError("Not permitted");

    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        contactPersonName: true,
        contactPhone: true,
        createdAt: true,
        _count: { select: { materials: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ suppliers });
  } catch (err) {
    return errorResponse(err);
  }
}

// 29 Oct 2026 (second pass): contactPersonName/contactPhone replace the old
// single free-text `contact` field (docs/decisions.md) — name already
// serves as the company name, these two are specifically the person to
// call and their number.
const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  contactPersonName: z.string().max(200).optional(),
  contactPhone: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInventory(actor.role)) throw new ForbiddenError("Not permitted");

    const json = await request.json().catch(() => null);
    const input = createSupplierSchema.parse(json);

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name: input.name,
          contactPersonName: input.contactPersonName,
          contactPhone: input.contactPhone,
        },
      });
      await logAudit(
        { actorId: actor.id, action: "supplier.created", targetType: "Supplier", targetId: created.id, after: { name: created.name } },
        tx
      );
      return created;
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
