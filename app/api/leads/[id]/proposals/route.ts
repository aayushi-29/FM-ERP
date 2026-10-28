import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";
import { assertNoOpenProposal } from "@/lib/crm/proposals";

// Leads aren't record-scoped the way Projects are (no ProjectAssignment
// equivalent) — the existing lead routes (app/api/leads/route.ts,
// app/api/leads/[id]/route.ts) gate on ADMIN/PROJECT_LEAD alone, so
// Proposals on a lead follow that same convention rather than inventing a
// new scoping rule.
const createProposalSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  validUntil: z.string().datetime().optional(),
});

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    void actor;

    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const proposals = await prisma.proposal.findMany({
      where: { leadId: params.id },
      include: {
        preparedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ versionNumber: "desc" }],
    });

    return NextResponse.json(proposals);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);

    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (lead.status === "CONVERTED") {
      throw new ValidationError("This lead has already been converted — no new proposals needed");
    }

    await assertNoOpenProposal(params.id);

    const json = await request.json().catch(() => null);
    const input = createProposalSchema.parse(json);

    const proposal = await prisma.$transaction(async (tx) => {
      const created = await tx.proposal.create({
        data: {
          leadId: params.id,
          title: input.title,
          content: input.content,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          preparedById: actor.id,
        },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "PROPOSAL_CREATED",
          targetType: "Proposal",
          targetId: created.id,
          after: { leadId: params.id, status: created.status, versionNumber: created.versionNumber },
        },
        tx
      );

      return created;
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
