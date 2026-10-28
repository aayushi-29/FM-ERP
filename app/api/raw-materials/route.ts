import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canReadInventory, canManageInventory } from "@/lib/inventory/scope";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET() {
  try {
    const user = await requireUser();
    if (!canReadInventory(user.role)) throw new ForbiddenError("Not permitted");

    const rawMaterials = await prisma.rawMaterial.findMany({
      select: {
        id: true,
        name: true,
        defaultUnit: true,
        defaultCostPerUnit: true,
        stockOnHand: true,
        reorderThreshold: true,
        supplier: { select: { id: true, name: true } },
        attachments: {
          select: { id: true, fileName: true, uploadedAt: true, uploadedBy: { select: { name: true } } },
          orderBy: { uploadedAt: "desc" },
        },
        stockMovements: {
          select: { id: true, quantityDelta: true, reason: true, recordedAt: true, recordedBy: { select: { name: true } } },
          orderBy: { recordedAt: "desc" },
          take: 5,
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ rawMaterials });
  } catch (err) {
    return errorResponse(err);
  }
}

const createRawMaterialSchema = z.object({
  name: z.string().min(1).max(200),
  supplierId: z.string().cuid().optional(),
  defaultUnit: z.string().min(1).max(30),
  defaultCostPerUnit: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  // 29 Oct 2026: stock monitoring addition — null/omitted means no
  // low-stock alerting is configured for this material.
  reorderThreshold: z.string().regex(/^\d+(\.\d+)?$/).optional(),
});

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInventory(actor.role)) throw new ForbiddenError("Not permitted");

    const json = await request.json().catch(() => null);
    const input = createRawMaterialSchema.parse(json);

    if (input.supplierId) {
      const supplier = await prisma.supplier.findUnique({ where: { id: input.supplierId } });
      if (!supplier) {
        return NextResponse.json({ error: "supplierId does not exist" }, { status: 400 });
      }
    }

    const rawMaterial = await prisma.$transaction(async (tx) => {
      const created = await tx.rawMaterial.create({
        data: {
          name: input.name,
          supplierId: input.supplierId,
          defaultUnit: input.defaultUnit,
          defaultCostPerUnit: input.defaultCostPerUnit ? new Decimal(input.defaultCostPerUnit) : undefined,
          reorderThreshold: input.reorderThreshold ? new Decimal(input.reorderThreshold) : undefined,
        },
      });
      await logAudit(
        { actorId: actor.id, action: "raw_material.created", targetType: "RawMaterial", targetId: created.id, after: { name: created.name } },
        tx
      );
      return created;
    });

    return NextResponse.json({ rawMaterial }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
