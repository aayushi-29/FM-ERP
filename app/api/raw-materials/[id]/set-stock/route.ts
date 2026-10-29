import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canManageInventory } from "@/lib/inventory/scope";
import { setStockOnHand } from "@/lib/inventory/stock";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// 29 Oct 2026 (second pass): "a simple way to adjust stockOnHand (a manual
// 'set current stock' action is enough for now — no movement ledger/
// history required)". Distinct from POST .../stock (a +/- delta) — this
// takes the number the person actually counted and lets setStockOnHand
// compute the delta, so staff never have to do that subtraction
// themselves. See docs/decisions.md for why this extends the existing
// stock infrastructure rather than adding a parallel field.
const schema = z.object({
  targetStock: z.string().regex(/^\d+(\.\d+)?$/, "Enter a plain number, e.g. 12 or 12.5"),
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

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await setStockOnHand(
        { rawMaterialId: params.id, targetStock: input.targetStock, recordedById: actor.id },
        tx
      );
      await logAudit(
        {
          actorId: actor.id,
          action: "raw_material.stock_set",
          targetType: "RawMaterial",
          targetId: params.id,
          after: { targetStock: input.targetStock, newStockOnHand: r.rawMaterial.stockOnHand.toString() },
        },
        tx
      );
      return r;
    });

    return NextResponse.json({
      movement: result.movement ? { ...result.movement, quantityDelta: result.movement.quantityDelta.toString() } : null,
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
