import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canReadInvoices, canManageInvoices, isInvoiceVisibleToClient } from "@/lib/costing/scope";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadInvoices(user.role)) throw new ForbiddenError("Not permitted");

    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: {
        lines: true,
        payments: { include: { recordedBy: { select: { id: true, name: true } }, verifiedBy: { select: { id: true, name: true } } }, orderBy: { receivedAt: "desc" } },
        creditNotes: { orderBy: { issuedAt: "desc" } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(user, invoice.projectId);

    if (user.role === "CLIENT" && !isInvoiceVisibleToClient(invoice.status)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (err) {
    return errorResponse(err);
  }
}

// Only DRAFT -> SENT and (any non-final status) -> CANCELLED are settable
// here directly. PARTIALLY_PAID and PAID are never set by hand — they're
// derived automatically from recorded payments (see
// app/api/invoices/[id]/payments/route.ts) so the status can't drift from
// the numbers backing it.
const updateSchema = z.object({
  action: z.enum(["SEND", "CANCEL"]),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageInvoices(actor.role)) throw new ForbiddenError("Only an Admin can change an invoice's status");

    const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, invoice.projectId);

    const input = updateSchema.parse(await request.json().catch(() => null));

    if (input.action === "SEND" && invoice.status !== "DRAFT") {
      throw new ForbiddenError("Only a DRAFT invoice can be sent");
    }
    if (input.action === "CANCEL" && (invoice.status === "PAID" || invoice.status === "CANCELLED")) {
      throw new ForbiddenError(`A ${invoice.status} invoice can't be cancelled`);
    }

    const nextStatus = input.action === "SEND" ? "SENT" : "CANCELLED";

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.invoice.update({ where: { id: params.id }, data: { status: nextStatus } });
      await logAudit(
        {
          actorId: actor.id,
          action: `invoice.${nextStatus.toLowerCase()}`,
          targetType: "Invoice",
          targetId: params.id,
          before: { status: invoice.status },
          after: { status: nextStatus },
        },
        tx
      );
      return result;
    });

    return NextResponse.json({ invoice: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
