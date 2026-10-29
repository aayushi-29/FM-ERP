import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import type { Prisma, InvoiceStatus } from "@prisma/client";
import { ValidationError } from "@/lib/api/respond";

type DbClient = typeof prisma | Prisma.TransactionClient;

// 29 Oct 2026 (second pass): Client payment claims (claim -> Admin verify ->
// acknowledgement). Deliberately a thin layer on top of the existing
// Payment model — Payment stays the only system of record, and a claim by
// itself never creates a Payment or changes Invoice.status (see
// docs/decisions.md). Only acknowledgePaymentClaim does that, and it does
// it exactly the way an Admin recording+verifying a payment manually would:
// same Payment fields, same status-derivation formula as
// app/api/invoices/[id]/payments/route.ts.

export function assertInvoiceClaimable(invoice: { status: string }) {
  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    throw new ValidationError(`Can't submit a payment claim against a ${invoice.status} invoice`);
  }
}

export function assertClaimPending(claim: { status: string }) {
  if (claim.status !== "PENDING") {
    throw new ValidationError(`This claim was already ${claim.status.toLowerCase()}`);
  }
}

// Same formula as the Payment route's status derivation — repeated rather
// than imported because importing a route handler isn't the pattern this
// codebase uses; both sides must be kept in sync if the formula ever
// changes (noted here and there).
export function deriveInvoiceStatusAfterPayment(
  invoice: { amount: string | Decimal },
  existingPayments: { amount: string | Decimal }[],
  existingCreditNotes: { amount: string | Decimal }[],
  newPaymentAmount: string | Decimal,
  currentStatus: InvoiceStatus
): InvoiceStatus {
  const totalPaid = existingPayments
    .reduce((sum, p) => sum.add(p.amount.toString()), new Decimal(0))
    .add(newPaymentAmount.toString());
  const totalCredited = existingCreditNotes.reduce((sum, c) => sum.add(c.amount.toString()), new Decimal(0));
  const netOwed = new Decimal(invoice.amount.toString()).sub(totalCredited);

  return totalPaid.gte(netOwed) ? "PAID" : totalPaid.gt(0) ? "PARTIALLY_PAID" : currentStatus;
}

export async function acknowledgePaymentClaim(
  input: { claimId: string; respondedById: string },
  db: DbClient = prisma
) {
  const claim = await db.paymentClaim.findUnique({ where: { id: input.claimId } });
  if (!claim) throw new ValidationError("Payment claim not found");
  assertClaimPending(claim);

  const invoice = await db.invoice.findUnique({
    where: { id: claim.invoiceId },
    include: { payments: true, creditNotes: true },
  });
  if (!invoice) throw new ValidationError("Invoice not found");

  const payment = await db.payment.create({
    data: {
      invoiceId: claim.invoiceId,
      amount: claim.amount,
      method: claim.paymentMode,
      reference: claim.acknowledgementOrInvoiceNumber,
      recordedById: input.respondedById,
      verifiedById: input.respondedById,
    },
  });

  const nextStatus = deriveInvoiceStatusAfterPayment(
    invoice,
    invoice.payments,
    invoice.creditNotes,
    claim.amount,
    invoice.status
  );
  const updatedInvoice = await db.invoice.update({ where: { id: invoice.id }, data: { status: nextStatus } });

  // 29 Oct 2026 (third pass): this Payment is created already-verified
  // (verifiedById is set above, unlike a manually recorded payment) — so
  // it never shows up in InvoiceActions' "Verify payment" list, and
  // app/api/payments/[id]/verify/route.ts (the only other place that sets
  // Project.advancePaymentVerifiedAt) never runs for it. Without this, a
  // client who paid the 60% advance via a claim — exactly the flow this
  // feature exists for — would have Admin acknowledge it, see the invoice
  // marked PAID, and still find the project permanently locked, since
  // nothing ever unlocked execution. Mirrors the manual-verify route's own
  // side effect exactly, so both paths to "the advance is verified" behave
  // the same way.
  if (invoice.paymentStage === "ADVANCE_60") {
    await db.project.update({
      where: { id: invoice.projectId },
      data: { advancePaymentVerifiedAt: new Date() },
    });
  }

  const updatedClaim = await db.paymentClaim.update({
    where: { id: claim.id },
    data: {
      status: "ACKNOWLEDGED",
      respondedById: input.respondedById,
      respondedAt: new Date(),
      resultingPaymentId: payment.id,
    },
  });

  return { claim: updatedClaim, payment, invoice: updatedInvoice };
}

export async function rejectPaymentClaim(
  input: { claimId: string; respondedById: string; adminNote: string },
  db: DbClient = prisma
) {
  const claim = await db.paymentClaim.findUnique({ where: { id: input.claimId } });
  if (!claim) throw new ValidationError("Payment claim not found");
  assertClaimPending(claim);

  const updatedClaim = await db.paymentClaim.update({
    where: { id: claim.id },
    data: {
      status: "REJECTED",
      respondedById: input.respondedById,
      respondedAt: new Date(),
      adminNote: input.adminNote,
    },
  });

  return { claim: updatedClaim };
}
