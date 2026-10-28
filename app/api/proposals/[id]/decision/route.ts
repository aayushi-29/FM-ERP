import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// Records what the client decided after a Proposal was SENT. There is no
// Client user account yet at the lead stage (see lib/crm/proposals.ts's
// comment), so this is always an Admin/Project Lead recording an offline
// decision, not a client-side action — exactly like how a payment is
// "verified" by an Admin confirming an offline bank acknowledgement.
//
// decision=REVISION_REQUESTED is "a revision loop back to Create
// Proposal": it marks this version REVISION_REQUESTED (terminal for this
// version, kept on record) and, in the same transaction, creates the next
// version as a new DRAFT the user can edit and resubmit — mirroring
// FormulationVersion's revise flow.
const schema = z.object({
  decision: z.enum(["ACCEPTED", "REVISION_REQUESTED"]),
  clientDecisionNotes: z.string().max(4000).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (proposal.status !== "SENT") {
      throw new ValidationError(
        `This proposal is ${proposal.status.toLowerCase().replace("_", " ")} — a client decision can only be recorded once it's been sent.`
      );
    }

    const json = await request.json().catch(() => null);
    const input = schema.parse(json);

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id: params.id },
        data: {
          status: input.decision,
          clientDecisionNotes: input.clientDecisionNotes,
          decidedAt: new Date(),
        },
      });

      let nextDraft = null;
      if (input.decision === "REVISION_REQUESTED") {
        nextDraft = await tx.proposal.create({
          data: {
            leadId: proposal.leadId,
            versionNumber: proposal.versionNumber + 1,
            previousVersionId: proposal.id,
            title: proposal.title,
            content: proposal.content,
            preparedById: actor.id,
          },
        });
      }

      await logAudit(
        {
          actorId: actor.id,
          action: input.decision === "ACCEPTED" ? "PROPOSAL_ACCEPTED" : "PROPOSAL_REVISION_REQUESTED",
          targetType: "Proposal",
          targetId: params.id,
          before: { status: "SENT" },
          after: { status: input.decision, nextVersionId: nextDraft?.id },
        },
        tx
      );

      return { proposal: updated, nextDraft };
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
