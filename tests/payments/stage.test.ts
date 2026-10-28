import { describe, it, expect } from "vitest";
import { PAYMENT_STAGE_PERCENT, PAYMENT_STAGE_LABEL, PAYMENT_STAGE_ORDER } from "@/lib/payments/stage";

// Pins down the fixed 60/25/15 split "Changed - Working Logic" branch
// requirement exactly as lib/payments/stage.ts documents it — the single
// place these percentages/labels are allowed to live.

describe("payment stage constants", () => {
  it("defines exactly the 60/25/15 split", () => {
    expect(PAYMENT_STAGE_PERCENT.ADVANCE_60).toBe(60);
    expect(PAYMENT_STAGE_PERCENT.SECOND_25).toBe(25);
    expect(PAYMENT_STAGE_PERCENT.FINAL_15).toBe(15);
  });

  it("sums to exactly 100", () => {
    const total = Object.values(PAYMENT_STAGE_PERCENT).reduce((sum, p) => sum + p, 0);
    expect(total).toBe(100);
  });

  it("has a display label for every stage", () => {
    for (const stage of PAYMENT_STAGE_ORDER) {
      expect(PAYMENT_STAGE_LABEL[stage]).toBeTruthy();
    }
  });

  it("orders the stages advance → second → final", () => {
    expect(PAYMENT_STAGE_ORDER).toEqual(["ADVANCE_60", "SECOND_25", "FINAL_15"]);
  });
});
