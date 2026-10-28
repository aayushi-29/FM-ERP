import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/api/respond";

// Confirmed with the user (29 Oct 2026): a lead can only be converted to a
// client/project once it has an ACCEPTED Proposal — see
// app/api/leads/[id]/convert/route.ts and docs/decisions.md's "Proposal
// workflow" note. This intentionally changes existing behavior: a lead
// sitting at QUALIFIED with no Proposal recorded (possible for any lead
// created before this branch) can no longer be converted until a Proposal
// is created and marked ACCEPTED for it. The error message says exactly
// that, rather than failing silently, so this is visible rather than a
// surprise.
export async function assertLeadHasAcceptedProposal(leadId: string): Promise<void> {
  const accepted = await prisma.proposal.findFirst({
    where: { leadId, status: "ACCEPTED" },
    select: { id: true },
  });

  if (!accepted) {
    throw new ValidationError(
      "This lead can't be converted yet — it needs an accepted Proposal first. " +
        "Create a Proposal, send it, and record the client's acceptance."
    );
  }
}

// Only one proposal should be "open" (actively being drafted/reviewed/
// sent) for a lead at a time — a REVISION_REQUESTED proposal's next
// version is created automatically by the revision action itself, not
// through this check, so this only guards the manually-triggered "create a
// new proposal" route.
export async function assertNoOpenProposal(leadId: string): Promise<void> {
  const open = await prisma.proposal.findFirst({
    where: { leadId, status: { in: ["DRAFT", "INTERNAL_REVIEW", "SENT"] } },
    select: { id: true },
  });

  if (open) {
    throw new ValidationError(
      "This lead already has an open proposal (not yet accepted or sent back for revision)."
    );
  }
}
