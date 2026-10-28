import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// "Internal Review → Approval → Send to Client" — this route performs both
// the approval and the send in one step (there is no separate "send"
// action), moving INTERNAL_REVIEW -> SENT and stamping sentAt. Mirrors
// formulation-version approvals: ADMIN or PROJECT_LEAD can decide,
// regardless of who authored the draft (app/api/formulation-versions/[id]
// /approve/route.ts does the same).
const schema = z.object({ reviewNotes: z.string().max(2000).optional() });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (proposal.status !== "INTERNAL_REVIEW") {
      throw new ValidationError(
        proposal.status === "DRAFT"
          ? "This proposal hasn't been submitted for review yet"
          : `This proposal is ${proposal.status.toLowerCase().replace("_", " ")} — it can't be approved from here.`
      );
    }

    const json = await request.json().catch(() => ({}));
    const input = schema.parse(json ?? {});

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id: params.id },
        data: {
          status: "SENT",
          reviewedById: actor.id,
          reviewNotes: input.reviewNotes,
          sentAt: new Date(),
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "PROPOSAL_APPROVED_AND_SENT",
          targetType: "Proposal",
          targetId: params.id,
          before: { status: "INTERNAL_REVIEW" },
          after: { status: "SENT", reviewedById: actor.id },
        },
        tx
      );

      return updated;
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
