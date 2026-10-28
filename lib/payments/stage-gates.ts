import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/api/respond";

// "second pay 25% after 1st sample" — a SECOND_25 invoice can't be raised
// on a project until at least one Trial has been logged against it. "1st
// sample" is read as "a trial exists" (a trial is the record of a sample
// run — baseline schema has no separate "sample" concept). Confirmed with
// the user 29 Oct 2026.
export async function assertFirstSampleExists(projectId: string): Promise<void> {
  const count = await prisma.trial.count({
    where: { formulationVersion: { formulation: { product: { projectId } } } },
  });
  if (count === 0) {
    throw new ValidationError(
      "The 25% invoice can't be raised until at least one trial has been logged on this project."
    );
  }
}

// "Remaining 15% before handling the final product" — the inverse of the
// 60% gate (lib/projects/execution-gate.ts): instead of payment unlocking
// work, here the final-product handover (Project.status -> COMPLETED) is
// blocked until the FINAL_15 invoice's Payment has been verified by an
// Admin. Confirmed with the user 29 Oct 2026 that "handling the final
// product" means marking the project COMPLETED/handed over.
export async function assertFinalPaymentVerified(projectId: string): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: {
      invoice: { projectId, paymentStage: "FINAL_15" },
      verifiedById: { not: null },
    },
  });
  if (!payment) {
    throw new ValidationError(
      "The final product can't be marked as handed over until the 15% final payment is verified."
    );
  }
}
