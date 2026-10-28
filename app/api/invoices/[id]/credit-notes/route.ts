import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number");

const createCreditNoteSchema = z.object({
  amount: decimalString,
  reason: z.string().min(1).max(1000),
});

// Admin-only, like every other write on Invoices/payments. A credit note
// reduces what's actually owed (see the payments route's status
// derivation, which nets credit notes against the invoice amount) without
// ever editing the original invoice total — the original number a client
// was sent stays intact and explainable.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { payments: true, creditNotes: true },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, invoice.projectId);

    if (invoice.status === "CANCELLED") {
      throw new ForbiddenError("Can't credit a cancelled invoice");
    }

    const input = createCreditNoteSchema.parse(await request.json().catch(() => null));

    const result = await prisma.$transaction(async (tx) => {
      const creditNote = await tx.creditNote.create({
        data: { invoiceId: params.id, issuedById: actor.id, amount: input.amount, reason: input.reason },
      });

      const totalPaid = invoice.payments.reduce((sum, p) => sum.add(p.amount.toString()), new Decimal(0));
      const totalCredited = invoice.creditNotes
        .reduce((sum, c) => sum.add(c.amount.toString()), new Decimal(0))
        .add(creditNote.amount.toString());
      const netOwed = new Decimal(invoice.amount.toString()).sub(totalCredited);

      const nextStatus = totalPaid.gte(netOwed) && netOwed.gt(0) ? "PAID" : invoice.status;

      const updatedInvoice = await tx.invoice.update({ where: { id: params.id }, data: { status: nextStatus } });

      await logAudit(
        {
          actorId: actor.id,
          action: "credit_note.issued",
          targetType: "CreditNote",
          targetId: creditNote.id,
          after: { invoiceId: params.id, amount: input.amount, reason: input.reason },
        },
        tx
      );
      await logProjectActivity(
        { projectId: invoice.projectId, actorId: actor.id, summary: `Credit note issued on ${invoice.invoiceNumber}: ${input.amount}` },
        tx
      );

      return { creditNote, invoice: updatedInvoice };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
