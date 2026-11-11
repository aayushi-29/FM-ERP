import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { ValidationError } from "@/lib/api/respond";
import { recordStockMovement } from "@/lib/inventory/stock";

type DbClient = typeof prisma | Prisma.TransactionClient;

// 11 Nov 2026: category-aware stock batches — confirmed with the user (see
// the comment on RawMaterial.category in prisma/schema.prisma for the full
// rationale). Two entry points, same shape as lib/inventory/stock.ts:
//
//  - receiveBatch: a delivery arrived. Creates one StockBatch row and
//    *also* calls recordStockMovement with a positive delta, so
//    RawMaterial.stockOnHand stays the same running total it always was —
//    this never becomes two numbers that can disagree.
//  - logBatchUsage: some of a specific batch got used, or had to be
//    thrown away. Decrements that batch's remainingQty and calls
//    recordStockMovement with a negative delta, same transaction.
//
// Deliberately no "receive/use without a batch" split path — a material
// that doesn't care about batch-level detail just never gets a batch
// created for it, and its stockOnHand/StockMovement keep working exactly
// as before via the existing stock-movement form.

export async function receiveBatch(
  input: {
    rawMaterialId: string;
    quantity: string | Decimal;
    // Omit to auto-fill from RawMaterial.shelfLifeDays (if set); pass null
    // explicitly for "no expiry for this particular batch" even on a
    // PERISHABLE material; pass a Date to override.
    expiresAt?: Date | null;
    recordedById: string;
  },
  db: DbClient = prisma
) {
  const rawMaterial = await db.rawMaterial.findUnique({ where: { id: input.rawMaterialId } });
  if (!rawMaterial) {
    throw new ValidationError("Raw material not found");
  }

  const quantity = new Decimal(input.quantity);
  if (quantity.lte(0)) {
    throw new ValidationError("Received quantity must be greater than zero");
  }

  let expiresAt: Date | null;
  if (input.expiresAt !== undefined) {
    expiresAt = input.expiresAt;
  } else if (rawMaterial.shelfLifeDays != null) {
    expiresAt = new Date(Date.now() + rawMaterial.shelfLifeDays * 24 * 60 * 60 * 1000);
  } else {
    expiresAt = null;
  }

  const batch = await db.stockBatch.create({
    data: {
      rawMaterialId: input.rawMaterialId,
      receivedQty: quantity,
      remainingQty: quantity,
      expiresAt: expiresAt ?? undefined,
      recordedById: input.recordedById,
    },
  });

  const { rawMaterial: updated } = await recordStockMovement(
    {
      rawMaterialId: input.rawMaterialId,
      quantityDelta: quantity,
      reason: `Batch received (${batch.id})`,
      recordedById: input.recordedById,
    },
    db
  );

  return { batch, rawMaterial: updated };
}

export async function logBatchUsage(
  input: {
    stockBatchId: string;
    type: "USED" | "WASTED";
    quantity: string | Decimal;
    note?: string;
    recordedById: string;
  },
  db: DbClient = prisma
) {
  const batch = await db.stockBatch.findUnique({ where: { id: input.stockBatchId } });
  if (!batch) {
    throw new ValidationError("Stock batch not found");
  }

  const quantity = new Decimal(input.quantity);
  if (quantity.lte(0)) {
    throw new ValidationError("Quantity must be greater than zero");
  }
  if (quantity.gt(batch.remainingQty)) {
    throw new ValidationError(
      `Only ${batch.remainingQty.toString()} remains in this batch — can't log ${quantity.toString()}.`
    );
  }

  const newRemaining = new Decimal(batch.remainingQty).sub(quantity);

  const movement = await db.stockBatchMovement.create({
    data: {
      stockBatchId: input.stockBatchId,
      type: input.type,
      quantity,
      note: input.note,
      recordedById: input.recordedById,
    },
  });

  const updatedBatch = await db.stockBatch.update({
    where: { id: input.stockBatchId },
    data: { remainingQty: newRemaining },
  });

  const { rawMaterial } = await recordStockMovement(
    {
      rawMaterialId: batch.rawMaterialId,
      quantityDelta: quantity.neg(),
      reason: `${input.type === "USED" ? "Used" : "Wasted"} from batch (${batch.id})${input.note ? ` — ${input.note}` : ""}`,
      recordedById: input.recordedById,
    },
    db
  );

  return { movement, batch: updatedBatch, rawMaterial };
}
