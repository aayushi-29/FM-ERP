import { describe, it, expect, vi, beforeEach } from "vitest";

// lib/payments/stage-gates.ts's two gates have deeply nested where-clauses
// (Trial -> FormulationVersion -> Formulation -> Product -> Project, and
// Payment -> Invoice -> Project+paymentStage) that don't fit the shared
// tests/setup/fakePrisma.ts helper, so this test fakes just the two calls
// these functions actually make.

let trialCount = 0;
let finalPayment: { id: string } | null = null;

const fakePrisma = {
  trial: {
    count: async () => trialCount,
  },
  payment: {
    findFirst: async () => finalPayment,
  },
};

vi.mock("@/lib/prisma", () => ({ get prisma() { return fakePrisma; } }));

const { assertFirstSampleExists, assertFinalPaymentVerified } = await import("@/lib/payments/stage-gates");
const { ValidationError } = await import("@/lib/api/respond");

describe("payment-stage sequencing gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trialCount = 0;
    finalPayment = null;
  });

  it("blocks the 25% invoice until at least one trial exists", async () => {
    trialCount = 0;
    await expect(assertFirstSampleExists("p1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows the 25% invoice once a trial has been logged", async () => {
    trialCount = 1;
    await expect(assertFirstSampleExists("p1")).resolves.toBeUndefined();
  });

  it("blocks final handover until the 15% payment is verified", async () => {
    finalPayment = null;
    await expect(assertFinalPaymentVerified("p1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("allows final handover once the 15% payment is verified", async () => {
    finalPayment = { id: "pay1" };
    await expect(assertFinalPaymentVerified("p1")).resolves.toBeUndefined();
  });
});
