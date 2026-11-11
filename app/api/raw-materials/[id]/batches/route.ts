import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, ForbiddenError } from "@/lib/auth/rbac";
import { canManageInventory } from "@/lib/inventory/scope";
import { receiveBatch } from "@/lib/inventory/batches";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// 11 Nov 2026: category-aware stock batches — confirmed with the user. A
// "receive" action distinct from the existing POST .../stock (a free-form
// +/- adjustment to the pooled total): this always creates a new,
// trackable StockBatch *and* keeps stockOnHand in sync via the same
// recordStockMovement path (lib/inventory/batches.ts), so it's additive to
// the existing stock-monitoring feature, not a replacement for it.
const schema = z.object({
  quantity: z.string().regex(/^\d+(\.\d+)?$/, "Enter a plain number, e.g. 5 or 5.5"),
  // Omit to auto-fill from the material's shelfLifeDays; pass an ISO date
  // string to override; pass null to explicitly mark this batch as having
  // no tracked expiry even if the material normally has one.
  expiresAt: z.string().datetime().nullable().optional(),
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
      const r = await receiveBatch(
        {
          rawMaterialId: params.id,
          quantity: input.quantity,
          expiresAt: input.expiresAt === undefined ? undefined : input.expiresAt === null ? null : new Date(input.expiresAt),
          recordedById: actor.id,
        },
        tx
      );
      await logAudit(
        {
          actorId: actor.id,
          action: "raw_material.batch_received",
          targetType: "RawMaterial",
          targetId: params.id,
          after: {
            batchId: r.batch.id,
            quantity: input.quantity,
            expiresAt: r.batch.expiresAt ? r.batch.expiresAt.toISOString() : null,
          },
        },
        tx
      );
      return r;
    });

    return NextResponse.json({
      batch: {
        ...result.batch,
        receivedQty: result.batch.receivedQty.toString(),
        remainingQty: result.batch.remainingQty.toString(),
      },
      rawMaterial: { ...result.rawMaterial, stockOnHand: result.rawMaterial.stockOnHand.toString() },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
