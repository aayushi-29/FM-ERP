import { describe, it, expect } from "vitest";
import { computeCostSheetTotals } from "@/lib/costing/compute";

// Not an authorization test, but guards the one piece of money math every
// cost sheet and invoice indirectly depends on — a regression here would
// silently change numbers Food Monk has already shown a client.

describe("computeCostSheetTotals", () => {
  it("applies yield and wastage before adding the flat costs", () => {
    const totals = computeCostSheetTotals({
      ingredientCost: "100",
      yieldPercent: "80", // divides ingredient cost by 0.8 => 125
      wastagePercent: "10", // then ×1.10 => 137.5
      packagingCost: "10",
      processingCost: "5",
      labourCost: "5",
      testingCost: "0",
      overheadCost: "0",
      batchSizeUnits: "100",
    });

    expect(totals.costPerBatch.toString()).toBe("157.5");
    expect(totals.costPerUnit.toString()).toBe("1.575");
  });

  it("rejects a zero or negative yield percent", () => {
    expect(() =>
      computeCostSheetTotals({
        ingredientCost: "100",
        yieldPercent: "0",
        wastagePercent: "0",
        packagingCost: "0",
        processingCost: "0",
        labourCost: "0",
        testingCost: "0",
        overheadCost: "0",
        batchSizeUnits: "10",
      })
    ).toThrow(/yieldPercent/);
  });

  it("rejects a zero or negative batch size", () => {
    expect(() =>
      computeCostSheetTotals({
        ingredientCost: "100",
        yieldPercent: "100",
        wastagePercent: "0",
        packagingCost: "0",
        processingCost: "0",
        labourCost: "0",
        testingCost: "0",
        overheadCost: "0",
        batchSizeUnits: "0",
      })
    ).toThrow(/batchSizeUnits/);
  });
});
