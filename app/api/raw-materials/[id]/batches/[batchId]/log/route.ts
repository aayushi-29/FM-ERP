import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canManageInventory } from "@/lib/inventory/scope";
import { logBatchUsage } from "@/lib/inventory/batches";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// 11 Nov 2026: category-aware stock batches — confirmed with the user.
// Logs "X of this specific batch got used" or "X had to be thrown away."
const schema = z.object({
  type: z.enum(["USED", "WASTED"]),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, "Enter a plain number, e.g. 2 or 2.5"),
  note: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string; batchId: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInventory(actor.role)) throw new ForbiddenError("Not permitted");

    const json = await request.json().catch(() => null);
    const input = schema.parse(json);

    const batch = await prisma.stockBatch.findUnique({ where: { id: params.batchId } });
    if (!batch || batch.rawMaterialId !== params.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const r = await logBatchUsage(
        {
          stockBatchId: params.batchId,
          type: input.type,
          quantity: input.quantity,
          note: input.note,
          recordedById: actor.id,
        },
        tx
      );
      await logAudit(
        {
          actorId: actor.id,
          action: input.type === "USED" ? "raw_material.batch_used" : "raw_material.batch_wasted",
          targetType: "RawMaterial",
          targetId: params.id,
          after: { batchId: params.batchId, quantity: input.quantity, note: input.note },
        },
        tx
      );
      return r;
    });

    return NextResponse.json({
      movement: { ...result.movement, quantity: result.movement.quantity.toString() },
      batch: { ...result.batch, receivedQty: result.batch.receivedQty.toString(), remainingQty: result.batch.remainingQty.toString() },
      rawMaterial: { ...result.rawMaterial, stockOnHand: result.rawMaterial.stockOnHand.toString() },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
