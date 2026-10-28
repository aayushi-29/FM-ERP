import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await requireRole(["ADMIN", "PROJECT_LEAD"]);

    const proposal = await prisma.proposal.findUnique({
      where: { id: params.id },
      include: {
        lead: { select: { id: true, companyName: true, status: true } },
        preparedBy: { select: { id: true, name: true } },
        reviewedBy: { select: { id: true, name: true } },
        previousVersion: { select: { id: true, versionNumber: true } },
        nextVersions: { select: { id: true, versionNumber: true, status: true } },
      },
    });
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(proposal);
  } catch (err) {
    return errorResponse(err);
  }
}

// Only editable while DRAFT — "Create Proposal" is the one status where
// the content is still being written. Submitting for review is its own
// explicit action (not folded into this PATCH) so the UI always shows one
// unambiguous next step.
const editSchema = z.object({
  action: z.literal("edit"),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(20000).optional(),
  validUntil: z.string().datetime().optional(),
});

const submitSchema = z.object({ action: z.literal("submit_for_review") });

const patchSchema = z.union([editSchema, submitSchema]);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);

    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });
    if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const json = await request.json().catch(() => null);
    const input = patchSchema.parse(json);

    if (proposal.status !== "DRAFT") {
      throw new ValidationError(
        `This proposal is ${proposal.status.toLowerCase().replace("_", " ")} — only a Draft proposal can be edited or submitted.`
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      if (input.action === "edit") {
        const updated = await tx.proposal.update({
          where: { id: params.id },
          data: {
            title: input.title ?? undefined,
            content: input.content ?? undefined,
            validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          },
        });
        await logAudit(
          { actorId: actor.id, action: "PROPOSAL_EDITED", targetType: "Proposal", targetId: params.id },
          tx
        );
        return updated;
      }

      // submit_for_review: DRAFT -> INTERNAL_REVIEW
      const updated = await tx.proposal.update({
        where: { id: params.id },
        data: { status: "INTERNAL_REVIEW" },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "PROPOSAL_SUBMITTED_FOR_REVIEW",
          targetType: "Proposal",
          targetId: params.id,
          before: { status: "DRAFT" },
          after: { status: "INTERNAL_REVIEW" },
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
