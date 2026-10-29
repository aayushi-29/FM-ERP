import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canReadInvoices, canManageInvoices, isInvoiceVisibleToClient } from "@/lib/costing/scope";
import { generateInvoiceNumber } from "@/lib/invoices/numbering";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { notify } from "@/lib/notifications";
import { PAYMENT_STAGE_LABEL } from "@/lib/payments/stage";
import { assertFirstSampleExists } from "@/lib/payments/stage-gates";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadInvoices(user.role)) throw new ForbiddenError("Not permitted");
    await assertProjectAccess(user, params.id);

    const invoices = await prisma.invoice.findMany({
      where: { projectId: params.id },
      select: {
        id: true, invoiceNumber: true, milestoneLabel: true, paymentStage: true, subtotal: true, taxAmount: true,
        amount: true, currency: true, dueDate: true, status: true, createdAt: true,
        payments: { select: { amount: true } },
        creditNotes: { select: { amount: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const visible = user.role === "CLIENT" ? invoices.filter((inv) => isInvoiceVisibleToClient(inv.status)) : invoices;

    return NextResponse.json({ invoices: visible });
  } catch (err) {
    return errorResponse(err);
  }
}

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number");

const lineSchema = z.object({
  description: z.string().min(1).max(300),
  amount: decimalString,
});

const createInvoiceSchema = z.object({
  milestoneLabel: z.string().max(200).optional(),
  // "Changed - Working Logic" branch: optionally tag this invoice as one of
  // the three fixed payment stages (lib/payments/stage.ts). Omit for an
  // ad-hoc/non-staged invoice — see the PaymentStage field comment in
  // schema.prisma.
  paymentStage: z.enum(["ADVANCE_60", "SECOND_25", "FINAL_15"]).optional(),
  // Decision #6: tax is an explicit figure supplied here, never a
  // hardcoded rate applied in code.
  taxAmount: decimalString.default("0"),
  currency: z.string().length(3).default("INR"),
  dueDate: z.string().datetime().optional(),
  lines: z.array(lineSchema).min(1),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInvoices(actor.role)) throw new ForbiddenError("Only an Admin can create an invoice");
    await assertProjectAccess(actor, params.id);

    const json = await request.json().catch(() => null);
    const input = createInvoiceSchema.parse(json);

    if (input.paymentStage) {
      const existing = await prisma.invoice.findFirst({
        where: { projectId: params.id, paymentStage: input.paymentStage },
        select: { id: true },
      });
      if (existing) {
        throw new ValidationError(
          `This project already has a ${PAYMENT_STAGE_LABEL[input.paymentStage]} invoice`
        );
      }
      if (input.paymentStage === "SECOND_25") {
        await assertFirstSampleExists(params.id);
      }
    }

    const subtotal = input.lines.reduce((sum, l) => sum.add(new Decimal(l.amount)), new Decimal(0));
    const taxAmount = new Decimal(input.taxAmount);
    const amount = subtotal.add(taxAmount);

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await prisma.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          projectId: params.id,
          createdById: actor.id,
          invoiceNumber,
          milestoneLabel: input.milestoneLabel,
          paymentStage: input.paymentStage,
          subtotal,
          taxAmount,
          amount,
          currency: input.currency,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          status: "DRAFT",
          lines: { createMany: { data: input.lines } },
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "invoice.created",
          targetType: "Invoice",
          targetId: created.id,
          after: { invoiceNumber, amount: amount.toString() },
        },
        tx
      );
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `Invoice ${invoiceNumber} drafted: ${amount} ${input.currency}` },
        tx
      );
      if (input.paymentStage) {
        // 29 Oct 2026 (fourth pass): confidentiality fix, confirmed with
        // the user — this message carries the invoice amount, which an
        // NPD Executive has no read access to (README's permission
        // matrix: "NPD Executive has no access" to Costing/Invoices).
        // "both" used to route it through "company", which includes any
        // NPD Executive assigned to the project; "financeAndClient"
        // reaches Admin + Project Lead + the Client, never NPD Executive.
        await notify(
          {
            projectId: params.id,
            audience: "financeAndClient",
            type: "invoice.staged",
            message: `Invoice ${invoiceNumber} raised for the ${PAYMENT_STAGE_LABEL[input.paymentStage]} (${amount} ${input.currency}).`,
            link: `/projects/${params.id}/costing`,
          },
          tx
        );
      }

      return created;
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
