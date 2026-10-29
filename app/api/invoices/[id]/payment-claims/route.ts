import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { assertInvoiceClaimable } from "@/lib/payments/claims";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { notify } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number");

const createClaimSchema = z.object({
  amount: decimalString,
  bankAccountNumber: z.string().min(1).max(64),
  paymentMode: z.string().min(1).max(100),
  acknowledgementOrInvoiceNumber: z.string().min(1).max(200),
});

// Client-only. This is ONLY a claim: it never touches Invoice.status and
// never creates a Payment — see lib/payments/claims.ts and
// docs/decisions.md. Admin's acknowledge/reject on the claim is the only
// thing that produces a real, system-of-record effect.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (actor.role !== "CLIENT") throw new ForbiddenError("Only a Client submits a payment claim");

    const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, invoice.projectId);
    assertInvoiceClaimable(invoice);

    const input = createClaimSchema.parse(await request.json().catch(() => null));

    const claim = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const created = await tx.paymentClaim.create({
        data: {
          invoiceId: invoice.id,
          submittedById: actor.id,
          amount: input.amount,
          bankAccountNumber: input.bankAccountNumber,
          paymentMode: input.paymentMode,
          acknowledgementOrInvoiceNumber: input.acknowledgementOrInvoiceNumber,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "payment_claim.submitted",
          targetType: "PaymentClaim",
          targetId: created.id,
          after: { invoiceId: invoice.id, amount: input.amount },
        },
        tx
      );
      await logProjectActivity(
        {
          projectId: invoice.projectId,
          actorId: actor.id,
          summary: `Payment claim submitted on ${invoice.invoiceNumber}: ${input.amount} ${invoice.currency}`,
        },
        tx
      );
      await notify(
        {
          projectId: invoice.projectId,
          audience: "company",
          type: "payment_claim.submitted",
          message: `A payment claim of ${input.amount} ${invoice.currency} was submitted on ${invoice.invoiceNumber}.`,
          link: `/invoices/${invoice.id}`,
        },
        tx
      );

      return created;
    });

    return NextResponse.json({ claim }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
