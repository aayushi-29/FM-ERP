import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

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

      return created;
    });

    return NextResponse.json({ version: revised }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
