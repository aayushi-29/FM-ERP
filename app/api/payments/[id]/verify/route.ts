import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { PAYMENT_STAGE_LABEL } from "@/lib/payments/stage";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// A payment is "recorded" by whoever has invoice-manage rights (currently
// Admin only, so this is Admin-only too in practice) and separately
// "verified" — the schema comment on Payment.verifiedById calls this out
// explicitly as a distinct step. Kept as its own route rather than folded
// into recording, so a bank-transfer entry that turns out to be wrong can
// sit as recorded-but-unverified without a second person's say-so, instead
// of being trusted the moment it's typed in.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: { invoice: { select: { projectId: true, paymentStage: true } } },
    });
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await assertProjectAccess(actor, payment.invoice.projectId);

    if (payment.verifiedById) {
      throw new ForbiddenError("This payment is already verified");
    }

    const projectId = payment.invoice.projectId;
    const stage = payment.invoice.paymentStage;
    const stageLabel = stage ? PAYMENT_STAGE_LABEL[stage] : null;

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.payment.update({ where: { id: params.id }, data: { verifiedById: actor.id } });
      await logAudit(
        {
          actorId: actor.id,
          action: "payment.verified",
          targetType: "Payment",
          targetId: params.id,
          after: { verifiedById: actor.id },
        },
        tx
      );

      // "the admin will mark that 60% is received" — this is that moment:
      // verifying the Payment on the project's ADVANCE_60 invoice unlocks
      // task/trial creation (lib/projects/execution-gate.ts). Only ever set
      // here, never by a client action, since there's no payment gateway.
      if (stage === "ADVANCE_60") {
        await tx.project.update({
          where: { id: projectId },
          data: { advancePaymentVerifiedAt: new Date() },
        });
      }

      if (stageLabel) {
        await notify(
          {
            projectId,
            audience: "both",
            type: "payment.verified",
            message:
              stage === "ADVANCE_60"
                ? `The ${stageLabel} has been verified — work on this project can now begin.`
                : `The ${stageLabel} has been verified.`,
            link: `/projects/${projectId}/costing`,
          },
          tx
        );
      }

      return result;
    });

    return NextResponse.json({ payment: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
