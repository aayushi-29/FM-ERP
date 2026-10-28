import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

const reviseSchema = z.object({
  // "Changed - Working Logic" branch: optionally mark an OPEN
  // RevisionRequest as ADDRESSED by this new version, in the same
  // transaction that creates it. Omit for a revision not prompted by a
  // client rework request (e.g. an internal correction).
  addressesRequestId: z.string().cuid().optional(),
});

// Baseline §7: "Formulation versions are immutable after publication/
// approval; revisions create new versions." Rather than ever un-finalizing
// an APPROVED or REJECTED version, this creates version N+1 as a fresh
// DRAFT, copying the ingredient lines so the NPD Executive edits a working
// copy instead of re-typing the whole recipe. Only ever runs off the
// *latest* version of a formulation — revising an old, superseded version
// would create a confusing branch, so this requires the version passed in
// to have no nextVersions yet.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "NPD_EXECUTIVE"]);
    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(actor, projectId);

    const version = await prisma.formulationVersion.findUnique({
      where: { id: params.id },
      include: { ingredientLines: true, nextVersions: { select: { id: true } } },
    });
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (version.status === "DRAFT" || version.status === "IN_REVIEW") {
      throw new ForbiddenError("Only an APPROVED or REJECTED version can be revised");
    }
    if (version.nextVersions.length > 0) {
      throw new ForbiddenError("A newer version already exists — revise that one instead");
    }

    const json = await request.json().catch(() => ({}));
    const input = reviseSchema.parse(json ?? {});

    let revisionRequest: { id: string; status: string; formulationVersionId: string } | null = null;
    if (input.addressesRequestId) {
      revisionRequest = await prisma.revisionRequest.findUnique({
        where: { id: input.addressesRequestId },
        select: { id: true, status: true, formulationVersionId: true },
      });
      if (!revisionRequest || revisionRequest.formulationVersionId !== version.id) {
        throw new ValidationError("addressesRequestId must be an open rework request on this version");
      }
      if (revisionRequest.status !== "OPEN") {
        throw new ValidationError("That rework request has already been addressed");
      }
    }

    const revised = await prisma.$transaction(async (tx) => {
      const created = await tx.formulationVersion.create({
        data: {
          formulationId: version.formulationId,
          versionNumber: version.versionNumber + 1,
          status: "DRAFT",
          previousVersionId: version.id,
          authorId: actor.id,
          processNotes: version.processNotes,
        },
      });

      if (version.ingredientLines.length > 0) {
        await tx.ingredientLine.createMany({
          data: version.ingredientLines.map((line) => ({
            formulationVersionId: created.id,
            materialName: line.materialName,
            rawMaterialId: line.rawMaterialId,
            quantity: line.quantity,
            unit: line.unit,
            percentage: line.percentage,
            technicalNotes: line.technicalNotes,
          })),
        });
      }

      await logProjectActivity(
        {
          projectId,
          actorId: actor.id,
          summary: `Formulation revised: v${version.versionNumber} → v${created.versionNumber}`,
        },
        tx
      );

      if (revisionRequest) {
        await tx.revisionRequest.update({
          where: { id: revisionRequest.id },
          data: { status: "ADDRESSED", addressedVersionId: created.id, addressedAt: new Date() },
        });
      }

      return created;
    });

    return NextResponse.json({ version: revised }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
