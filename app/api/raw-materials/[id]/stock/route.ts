import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canManageInventory } from "@/lib/inventory/scope";
import { recordStockMovement } from "@/lib/inventory/stock";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Positive quantityDelta = stock added (e.g. a delivery received),
// negative = consumed/wasted/corrected downward. No separate "type" field —
// `reason` is a free-text note for why, which is enough for the lightweight
// version of this the user asked for (see lib/inventory/stock.ts).
const schema = z.object({
  quantityDelta: z.string().regex(/^-?\d+(\.\d+)?$/),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInventory(actor.role)) throw new ForbiddenError("Not permitted");

    const json = await request.json().catch(() => null);
    const input = schema.parse(json);

    const result = await prisma.$transaction(async (tx) => {
      const r = await recordStockMovement(
        { rawMaterialId: params.id, quantityDelta: input.quantityDelta, reason: input.reason, recordedById: actor.id },
        tx
      );
      await logAudit(
        {
          actorId: actor.id,
          action: "raw_material.stock_movement",
          targetType: "RawMaterial",
          targetId: params.id,
          after: { quantityDelta: input.quantityDelta, newStockOnHand: r.rawMaterial.stockOnHand.toString() },
        },
        tx
      );
      return r;
    });

    return NextResponse.json({
      movement: { ...result.movement, quantityDelta: result.movement.quantityDelta.toString() },
      rawMaterial: {
        ...result.rawMaterial,
        stockOnHand: result.rawMaterial.stockOnHand.toString(),
        reorderThreshold: result.rawMaterial.reorderThreshold ? result.rawMaterial.reorderThreshold.toString() : null,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
