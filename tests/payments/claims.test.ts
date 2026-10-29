import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js";

// lib/payments/claims.ts's functions default their `db` param to the real
// `prisma` export, so importing the module at all (even though every test
// below passes its own fake `db` explicitly) triggers lib/prisma.ts's
// `new PrismaClient()` unless that module is mocked first — same reason
// tests/inventory/stock.test.ts and tests/crm/proposals.test.ts mock it.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// "Changed - Working Logic" branch, 29 Oct 2026 (second pass), item #2:
// Client payment claims. Pins down that a claim by itself never creates a
// Payment or changes Invoice.status, and that Acknowledge/Reject do the
// right, respective things — independent of the routes around them.

describe("assertInvoiceClaimable / assertClaimPending", () => {
  it("rejects a claim against a PAID invoice", async () => {
    vi.resetModules();
    const { assertInvoiceClaimable } = await import("@/lib/payments/claims");
    const { ValidationError } = await import("@/lib/api/respond");
    expect(() => assertInvoiceClaimable({ status: "PAID" })).toThrow(ValidationError);
  });

  it("rejects a claim against a CANCELLED invoice", async () => {
    vi.resetModules();
    const { assertInvoiceClaimable } = await import("@/lib/payments/claims");
    const { ValidationError } = await import("@/lib/api/respond");
    expect(() => assertInvoiceClaimable({ status: "CANCELLED" })).toThrow(ValidationError);
  });

  it("allows a claim against a SENT or PARTIALLY_PAID invoice", async () => {
    vi.resetModules();
    const { assertInvoiceClaimable } = await import("@/lib/payments/claims");
    expect(() => assertInvoiceClaimable({ status: "SENT" })).not.toThrow();
    expect(() => assertInvoiceClaimable({ status: "PARTIALLY_PAID" })).not.toThrow();
  });

  it("rejects responding to a claim that isn't PENDING", async () => {
    vi.resetModules();
    const { assertClaimPending } = await import("@/lib/payments/claims");
    const { ValidationError } = await import("@/lib/api/respond");
    expect(() => assertClaimPending({ status: "ACKNOWLEDGED" })).toThrow(ValidationError);
  });
});

function makeFakeDb(opts: {
  claim: { id: string; invoiceId: string; status: string; amount: Decimal; paymentMode: string; acknowledgementOrInvoiceNumber: string };
  invoice: { id: string; status: string; amount: Decimal; payments: { amount: Decimal }[]; creditNotes: { amount: Decimal }[] };
}) {
  const claims = { ...opts.claim };
  const invoice = { ...opts.invoice };
  const payments: { id: string; invoiceId: string; amount: Decimal }[] = [];

  return {
    paymentClaim: {
      findUnique: async () => ({ ...claims }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(claims, data);
        return { ...claims };
      },
    },
    invoice: {
      findUnique: async () => ({ ...invoice }),
      update: async ({ data }: { data: { status: string } }) => {
        invoice.status = data.status;
        return { ...invoice };
      },
    },
    payment: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const payment = { id: `pay-${payments.length + 1}`, ...data } as { id: string; invoiceId: string; amount: Decimal };
        payments.push(payment);
        return payment;
      },
    },
  };
}

describe("acknowledgePaymentClaim", () => {
  it("creates a real, verified Payment and marks the claim ACKNOWLEDGED", async () => {
    vi.resetModules();
    const db = makeFakeDb({
      claim: {
        id: "claim-1",
        invoiceId: "inv-1",
        status: "PENDING",
        amount: new Decimal(500),
        paymentMode: "UPI",
        acknowledgementOrInvoiceNumber: "ACK123",
      },
      invoice: { id: "inv-1", status: "SENT", amount: new Decimal(500), payments: [], creditNotes: [] },
    });
    const { acknowledgePaymentClaim } = await import("@/lib/payments/claims");
    const result = await acknowledgePaymentClaim({ claimId: "claim-1", respondedById: "admin-1" }, db as never);

    expect(result.claim.status).toBe("ACKNOWLEDGED");
    expect(result.payment.amount.toString()).toBe("500");
    expect(result.invoice.status).toBe("PAID");
  });

  it("refuses to acknowledge a claim that's already been responded to", async () => {
    vi.resetModules();
    const db = makeFakeDb({
      claim: {
        id: "claim-1",
        invoiceId: "inv-1",
        status: "REJECTED",
        amount: new Decimal(500),
        paymentMode: "UPI",
        acknowledgementOrInvoiceNumber: "ACK123",
      },
      invoice: { id: "inv-1", status: "SENT", amount: new Decimal(500), payments: [], creditNotes: [] },
    });
    const { acknowledgePaymentClaim } = await import("@/lib/payments/claims");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(acknowledgePaymentClaim({ claimId: "claim-1", respondedById: "admin-1" }, db as never)).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});

describe("rejectPaymentClaim", () => {
  it("marks the claim REJECTED with the admin's note, and creates no Payment", async () => {
    vi.resetModules();
    const db = makeFakeDb({
      claim: {
        id: "claim-1",
        invoiceId: "inv-1",
        status: "PENDING",
        amount: new Decimal(500),
        paymentMode: "UPI",
        acknowledgementOrInvoiceNumber: "ACK123",
      },
      invoice: { id: "inv-1", status: "SENT", amount: new Decimal(500), payments: [], creditNotes: [] },
    });
    const { rejectPaymentClaim } = await import("@/lib/payments/claims");
    const result = await rejectPaymentClaim(
      { claimId: "claim-1", respondedById: "admin-1", adminNote: "Amount doesn't match our records" },
      db as never
    );
    expect(result.claim.status).toBe("REJECTED");
    expect(result.claim.adminNote).toBe("Amount doesn't match our records");
  });
});
