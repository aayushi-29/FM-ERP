import { NextResponse } from "next/server";
import { z } from "zod";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canReadInvoices, canManageInvoices, isInvoiceVisibleToClient } from "@/lib/costing/scope";
import { generateInvoiceNumber } from "@/lib/invoices/numbering";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadInvoices(user.role)) throw new ForbiddenError("Not permitted");
    await assertProjectAccess(user, params.id);

    const invoices = await prisma.invoice.findMany({
      where: { projectId: params.id },
      select: {
        id: true, invoiceNumber: true, milestoneLabel: true, subtotal: true, taxAmount: true,
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

      return created;
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
