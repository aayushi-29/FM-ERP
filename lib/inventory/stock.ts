import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/api/respond";
import { notifyCompanyWide } from "@/lib/notifications";

type DbClient = typeof prisma | Prisma.TransactionClient;

// 29 Oct 2026: "lightweight stock-movement model" — confirmed with the
// user, explicitly superseding Decision #7's "no stock ledger" (see
// docs/decisions.md). Records one signed delta, keeps RawMaterial
// .stockOnHand in sync in the same transaction, and fires a company-wide
// notification the first time the resulting balance drops to or below the
// configured reorderThreshold. Deliberately not the fuller
// receipt/purchase-order/reservation system baseline §6.6 describes for
// Phase 2.
export async function recordStockMovement(
  input: { rawMaterialId: string; quantityDelta: string | Decimal; reason?: string; recordedById: string },
  db: DbClient = prisma
) {
  const rawMaterial = await db.rawMaterial.findUnique({ where: { id: input.rawMaterialId } });
  if (!rawMaterial) {
    throw new ValidationError("Raw material not found");
  }

  const delta = new Decimal(input.quantityDelta);
  const newStock = new Decimal(rawMaterial.stockOnHand).add(delta);
  if (newStock.lt(0)) {
    throw new ValidationError(
      `This would take stock on hand negative (currently ${rawMaterial.stockOnHand.toString()} ${rawMaterial.defaultUnit}).`
    );
  }

  const movement = await db.stockMovement.create({
    data: {
      rawMaterialId: input.rawMaterialId,
      quantityDelta: delta,
      reason: input.reason,
      recordedById: input.recordedById,
    },
  });

  const updated = await db.rawMaterial.update({
    where: { id: input.rawMaterialId },
    data: { stockOnHand: newStock },
  });

  const wasAboveThreshold =
    rawMaterial.reorderThreshold != null && new Decimal(rawMaterial.stockOnHand).gt(rawMaterial.reorderThreshold);
  const isAtOrBelowThreshold =
    updated.reorderThreshold != null && newStock.lte(updated.reorderThreshold);

  // Only notify on the crossing (was above, now at/below) rather than on
  // every movement while already low, so this doesn't spam a notification
  // per adjustment while stock sits under threshold.
  if (wasAboveThreshold && isAtOrBelowThreshold) {
    await notifyCompanyWide(
      {
        type: "inventory.low_stock",
        message: `${updated.name} is low: ${newStock.toString()} ${updated.defaultUnit} on hand (reorder threshold ${updated.reorderThreshold!.toString()}).`,
        link: "/raw-materials",
      },
      db
    );
  }

  return { movement, rawMaterial: updated };
}
