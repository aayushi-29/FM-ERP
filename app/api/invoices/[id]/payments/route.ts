import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canManageInvoices } from "@/lib/costing/scope";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number");

const createPaymentSchema = z.object({
  amount: decimalString,
  method: z.string().max(100).optional(),
  reference: z.string().max(200).optional(),
  receivedAt: z.string().datetime().optional(),
});

// Recording a payment is Admin-only (baseline: Invoices/payments "Manage"
// is Admin's row alone) — a Client sees their payment status but never
// reports their own payment, since that would let an unverified claim
// change what the system shows as paid.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInvoices(actor.role)) throw new ForbiddenError("Only an Admin can record a payment");

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { payments: true, creditNotes: true },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, invoice.projectId);

    if (invoice.status === "CANCELLED") {
      throw new ForbiddenError("Can't record a payment against a cancelled invoice");
    }

    const input = createPaymentSchema.parse(await request.json().catch(() => null));

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: params.id,
          amount: input.amount,
          method: input.method,
          reference: input.reference,
          recordedById: actor.id,
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : undefined,
        },
      });

      // Status is derived, never set directly, from this invoice's own
      // amount minus every payment and credit note recorded against it —
      // so it can never drift from the numbers that back it.
      const totalPaid = invoice.payments
        .reduce((sum, p) => sum.add(p.amount.toString()), new Decimal(0))
        .add(payment.amount.toString());
      const totalCredited = invoice.creditNotes.reduce((sum, c) => sum.add(c.amount.toString()), new Decimal(0));
      const netOwed = new Decimal(invoice.amount.toString()).sub(totalCredited);

      const nextStatus = totalPaid.gte(netOwed) ? "PAID" : totalPaid.gt(0) ? "PARTIALLY_PAID" : invoice.status;

      const updatedInvoice = await tx.invoice.update({
        where: { id: params.id },
        data: { status: nextStatus },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "payment.recorded",
          targetType: "Payment",
          targetId: payment.id,
          after: { invoiceId: params.id, amount: input.amount, resultingStatus: nextStatus },
        },
        tx
      );
      await logProjectActivity(
        { projectId: invoice.projectId, actorId: actor.id, summary: `Payment of ${input.amount} ${invoice.currency} recorded on ${invoice.invoiceNumber}` },
        tx
      );

      return { payment, invoice: updatedInvoice };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
