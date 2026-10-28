import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canReadCosting, canManageCosting } from "@/lib/costing/scope";
import { computeCostSheetTotals } from "@/lib/costing/compute";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadCosting(user.role)) throw new ForbiddenError("Not permitted");
    await assertProjectAccess(user, params.id);

    const costSheets = await prisma.costSheet.findMany({
      where: { projectId: params.id },
      include: {
        formulationVersion: { select: { id: true, versionNumber: true, formulation: { select: { name: true } } } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ costSheets });
  } catch (err) {
    return errorResponse(err);
  }
}

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number");

const createCostSheetSchema = z.object({
  formulationVersionId: z.string().cuid(),
  priceBasis: z.enum(["ESTIMATE", "SUPPLIER_QUOTE", "ACTUAL"]),
  ingredientCost: decimalString,
  yieldPercent: decimalString,
  wastagePercent: decimalString,
  packagingCost: decimalString,
  processingCost: decimalString,
  labourCost: decimalString,
  testingCost: decimalString,
  overheadCost: decimalString,
  batchSizeUnits: decimalString,
  // 29 Oct 2026: Cost Intelligence addition — optional; omitted means no
  // recommendedSellingPrice is computed or stored (see
  // lib/costing/compute.ts).
  markupPercent: decimalString.optional(),
  notes: z.string().max(2000).optional(),
  // When recalculating an existing cost sheet rather than pricing a
  // formulation version for the first time — points the new row at the
  // one it supersedes (baseline: "estimate vs. actual kept separate",
  // and the non-negotiable that a historical number is never overwritten).
  supersedesId: z.string().cuid().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageCosting(actor.role)) throw new ForbiddenError("Only an Admin can create a cost sheet");
    await assertProjectAccess(actor, params.id);

    const json = await request.json().catch(() => null);
    const input = createCostSheetSchema.parse(json);

    const version = await prisma.formulationVersion.findUnique({
      where: { id: input.formulationVersionId },
      select: { id: true, formulation: { select: { product: { select: { projectId: true } } } } },
    });
    if (!version || version.formulation.product.projectId !== params.id) {
      return NextResponse.json({ error: "formulationVersionId must be a version in this project" }, { status: 400 });
    }

    if (input.supersedesId) {
      const prior = await prisma.costSheet.findUnique({ where: { id: input.supersedesId } });
      if (!prior || prior.projectId !== params.id) {
        return NextResponse.json({ error: "supersedesId must be a cost sheet in this project" }, { status: 400 });
      }
    }

    let totals;
    try {
      totals = computeCostSheetTotals(input);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid cost inputs" }, { status: 400 });
    }

    const costSheet = await prisma.$transaction(async (tx) => {
      const created = await tx.costSheet.create({
        data: {
          projectId: params.id,
          formulationVersionId: input.formulationVersionId,
          createdById: actor.id,
          priceBasis: input.priceBasis,
          ingredientCost: input.ingredientCost,
          yieldPercent: input.yieldPercent,
          wastagePercent: input.wastagePercent,
          packagingCost: input.packagingCost,
          processingCost: input.processingCost,
          labourCost: input.labourCost,
          testingCost: input.testingCost,
          overheadCost: input.overheadCost,
          batchSizeUnits: input.batchSizeUnits,
          costPerBatch: totals.costPerBatch,
          costPerUnit: totals.costPerUnit,
          markupPercent: input.markupPercent ?? undefined,
          recommendedSellingPrice: totals.recommendedSellingPrice ?? undefined,
          notes: input.notes,
          supersedesId: input.supersedesId,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "cost_sheet.created",
          targetType: "CostSheet",
          targetId: created.id,
          after: { priceBasis: input.priceBasis, costPerUnit: totals.costPerUnit.toString() },
        },
        tx
      );
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `Cost sheet ${input.supersedesId ? "recalculated" : "created"}: ${totals.costPerUnit}/unit` },
        tx
      );

      return created;
    });

    return NextResponse.json({ costSheet }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
