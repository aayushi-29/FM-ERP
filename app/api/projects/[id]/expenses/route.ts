import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canReadCosting, canManageCosting } from "@/lib/costing/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Treated as part of the Costing module (baseline has no separate
// "Expenses" row) — same Admin-manage / Project-Lead-read split.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadCosting(user.role)) throw new ForbiddenError("Not permitted");
    await assertProjectAccess(user, params.id);

    const expenses = await prisma.projectExpense.findMany({
      where: { projectId: params.id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { incurredAt: "desc" },
    });

    return NextResponse.json({ expenses });
  } catch (err) {
    return errorResponse(err);
  }
}

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number");

const createExpenseSchema = z.object({
  description: z.string().min(1).max(300),
  amount: decimalString,
  currency: z.string().length(3).default("INR"),
  incurredAt: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageCosting(actor.role)) throw new ForbiddenError("Only an Admin can log a project expense");
    await assertProjectAccess(actor, params.id);

    const input = createExpenseSchema.parse(await request.json().catch(() => null));

    const expense = await prisma.$transaction(async (tx) => {
      const created = await tx.projectExpense.create({
        data: {
          projectId: params.id,
          createdById: actor.id,
          description: input.description,
          amount: input.amount,
          currency: input.currency,
          incurredAt: input.incurredAt ? new Date(input.incurredAt) : undefined,
        },
      });
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `Expense logged: ${input.description} (${input.amount} ${input.currency})` },
        tx
      );
      return created;
    });

    return NextResponse.json({ expense }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
