import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { acknowledgePaymentClaim } from "@/lib/payments/claims";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { notify } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// Admin-only, same as every other write on Invoices/payments. Creates the
// real, verified Payment from the claimed details — exactly as if Admin
// had recorded+verified it manually — and sets the claim to ACKNOWLEDGED.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);

    const claim = await prisma.paymentClaim.findUnique({ where: { id: params.id }, include: { invoice: true } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, claim.invoice.projectId);

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await acknowledgePaymentClaim({ claimId: params.id, respondedById: actor.id }, tx);

      await logAudit(
        {
          actorId: actor.id,
          action: "payment_claim.acknowledged",
          targetType: "PaymentClaim",
          targetId: r.claim.id,
          after: { paymentId: r.payment.id, amount: r.claim.amount },
        },
        tx
      );
      await logProjectActivity(
        {
          projectId: claim.invoice.projectId,
          actorId: actor.id,
          summary: `Payment claim on ${claim.invoice.invoiceNumber} acknowledged: ${r.claim.amount.toString()} ${claim.invoice.currency}`,
        },
        tx
      );
      await notify(
        {
          projectId: claim.invoice.projectId,
          audience: "client",
          type: "payment_claim.acknowledged",
          message: `Your payment claim of ${r.claim.amount.toString()} ${claim.invoice.currency} on ${claim.invoice.invoiceNumber} was acknowledged.`,
          link: `/invoices/${claim.invoice.id}`,
        },
        tx
      );
      // Same "work can now begin" moment as app/api/payments/[id]/verify
      // (see lib/payments/claims.ts's acknowledgePaymentClaim, which sets
      // Project.advancePaymentVerifiedAt for this stage) — notify both
      // sides the project unlocked, not just that the claim was acknowledged.
      if (claim.invoice.paymentStage === "ADVANCE_60") {
        await notify(
          {
            projectId: claim.invoice.projectId,
            audience: "both",
            type: "payment.verified",
            message: "The 60% advance has been verified — work on this project can now begin.",
            link: `/projects/${claim.invoice.projectId}/costing`,
          },
          tx
        );
      }

      return r;
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ValidationError) return errorResponse(err);
    return errorResponse(err);
  }
}
