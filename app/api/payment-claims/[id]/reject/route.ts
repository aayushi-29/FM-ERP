import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { rejectPaymentClaim } from "@/lib/payments/claims";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { notify } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const schema = z.object({ reason: z.string().min(1).max(500) });

// Admin-only. Rejecting does NOT create a Payment or change Invoice.status
// — the claim stays visible to the Client with the reason attached.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);

    const claim = await prisma.paymentClaim.findUnique({ where: { id: params.id }, include: { invoice: true } });
    if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, claim.invoice.projectId);

    const input = schema.parse(await request.json().catch(() => null));

    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const r = await rejectPaymentClaim({ claimId: params.id, respondedById: actor.id, adminNote: input.reason }, tx);

      await logAudit(
        {
          actorId: actor.id,
          action: "payment_claim.rejected",
          targetType: "PaymentClaim",
          targetId: r.claim.id,
          after: { reason: input.reason },
        },
        tx
      );
      await logProjectActivity(
        {
          projectId: claim.invoice.projectId,
          actorId: actor.id,
          summary: `Payment claim on ${claim.invoice.invoiceNumber} rejected: ${input.reason}`,
        },
        tx
      );
      // 29 Oct 2026 (fourth pass): confirmed with the user — a rejection
      // that needs the recipient to act (resubmit with corrected details)
      // is flagged urgent, separate from routine notices.
      await notify(
        {
          projectId: claim.invoice.projectId,
          audience: "client",
          type: "payment_claim.rejected",
          message: `Your payment claim on ${claim.invoice.invoiceNumber} was rejected: ${input.reason}`,
          link: `/invoices/${claim.invoice.id}`,
          urgent: true,
        },
        tx
      );

      return r;
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
