// Decision #4's formula, as confirmed so far: "Ingredient cost ×
// yield/wastage + packaging/processing/labour/testing/overhead." The
// ACCOUNTANT HAS NOT CONFIRMED the exact arithmetic or rates (flagged in
// docs/decisions.md) — this is one reasonable reading, isolated in a
// single function precisely so it can be swapped for the confirmed
// version without touching any route:
//
//   effective ingredient cost = ingredientCost / (yieldPercent / 100)
//                                              × (1 + wastagePercent / 100)
//
//   (yield% divides because a lower yield means more input is consumed to
//   get one full batch out; wastage% then adds an allowance on top of
//   that.)
//
//   costPerBatch = effective ingredient cost + packaging + processing +
//                  labour + testing + overhead
//   costPerUnit  = costPerBatch / batchSizeUnits
//
// All arithmetic here happens on `Decimal.js` (Prisma's Decimal type),
// never on JS `number` — baseline §7: "never use floating-point
// arithmetic for financial totals."
// Imported directly from decimal.js — not via `Prisma.Decimal` — so this
// module's types resolve correctly even against the stub Prisma client
// this sandbox generates (binaries.prisma.sh is blocked here; see
// README's sandbox-limitation note). Prisma's own Decimal fields are
// decimal.js instances at runtime, so values read from Prisma convert
// into this `Decimal` with no precision loss either way.
import Decimal from "decimal.js";

export interface CostSheetInputs {
  ingredientCost: Decimal | string;
  yieldPercent: Decimal | string;
  wastagePercent: Decimal | string;
  packagingCost: Decimal | string;
  processingCost: Decimal | string;
  labourCost: Decimal | string;
  testingCost: Decimal | string;
  overheadCost: Decimal | string;
  batchSizeUnits: Decimal | string;
  // 29 Oct 2026: Cost Intelligence addition — confirmed with the user.
  // Optional: when omitted, no recommendedSellingPrice is computed at all
  // (not even a zero/null placeholder meant to look authoritative).
  markupPercent?: Decimal | string;
}

export interface CostSheetTotals {
  costPerBatch: Decimal;
  costPerUnit: Decimal;
  // A SUGGESTION only — see this file's header comment and the schema
  // comment on CostSheet.recommendedSellingPrice. Decision #4 (costing
  // formula) still needs accountant sign-off; this is one more reasonable
  // reading on top of that, isolated here so it can be swapped or dropped
  // without touching any route. Undefined when markupPercent wasn't given.
  recommendedSellingPrice?: Decimal;
}

export function computeCostSheetTotals(input: CostSheetInputs): CostSheetTotals {
  const ingredientCost = new Decimal(input.ingredientCost);
  const yieldPercent = new Decimal(input.yieldPercent);
  const wastagePercent = new Decimal(input.wastagePercent);
  const batchSizeUnits = new Decimal(input.batchSizeUnits);

  if (yieldPercent.lte(0)) {
    throw new Error("yieldPercent must be greater than 0");
  }
  if (batchSizeUnits.lte(0)) {
    throw new Error("batchSizeUnits must be greater than 0");
  }

  const effectiveIngredientCost = ingredientCost
    .div(yieldPercent.div(100))
    .mul(new Decimal(1).add(wastagePercent.div(100)));

  const costPerBatch = effectiveIngredientCost
    .add(new Decimal(input.packagingCost))
    .add(new Decimal(input.processingCost))
    .add(new Decimal(input.labourCost))
    .add(new Decimal(input.testingCost))
    .add(new Decimal(input.overheadCost));

  const costPerUnit = costPerBatch.div(batchSizeUnits);

  // Markup-on-cost (not margin-on-price): recommendedSellingPrice =
  // costPerUnit × (1 + markupPercent / 100). Chosen over a margin-on-price
  // formula (price = cost / (1 - margin%)) because it's the simpler,
  // more common reading of "markup" and avoids a division that blows up
  // as margin% approaches 100 — a margin-based version can be swapped in
  // later without touching any route, same as the rest of this function.
  const recommendedSellingPrice =
    input.markupPercent !== undefined
      ? costPerUnit.mul(new Decimal(1).add(new Decimal(input.markupPercent).div(100))).toDecimalPlaces(4)
      : undefined;

  return {
    costPerBatch: costPerBatch.toDecimalPlaces(2),
    costPerUnit: costPerUnit.toDecimalPlaces(4),
    recommendedSellingPrice,
  };
}
