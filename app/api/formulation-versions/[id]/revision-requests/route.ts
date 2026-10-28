import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { notify } from "@/lib/notifications";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";

// "After approval add rework section when client changes their
// requirements." A Client files this against an APPROVED version; it never
// mutates that version (still immutable per Decision #3/baseline §7) — NPD
// /Admin addresses it through the existing revise flow, which creates
// version N+1 and can link back here. Any role with project access may
// read the list (internal roles want to see what's been asked for, not
// just the Client who filed it).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(user, projectId);

    const revisionRequests = await prisma.revisionRequest.findMany({
      where: { formulationVersionId: params.id },
      select: {
        id: true,
        notes: true,
        status: true,
        createdAt: true,
        addressedAt: true,
        addressedVersionId: true,
        requestedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ revisionRequests });
  } catch (err) {
    return errorResponse(err);
  }
}

const createRevisionRequestSchema = z.object({
  notes: z.string().min(1).max(4000),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["CLIENT"]);
    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(actor, projectId);

    const version = await prisma.formulationVersion.findUnique({ where: { id: params.id } });
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (version.status !== "APPROVED") {
      throw new ForbiddenError("A rework request can only be filed against an approved version");
    }

    const json = await request.json().catch(() => null);
    const input = createRevisionRequestSchema.parse(json);

    const openExisting = await prisma.revisionRequest.findFirst({
      where: { formulationVersionId: params.id, status: "OPEN" },
    });
    if (openExisting) {
      throw new ValidationError("There's already an open rework request on this version");
    }

    const revisionRequest = await prisma.$transaction(async (tx) => {
      const created = await tx.revisionRequest.create({
        data: {
          formulationVersionId: params.id,
          requestedById: actor.id,
          notes: input.notes,
        },
      });

      await logProjectActivity(
        { projectId, actorId: actor.id, summary: `Rework requested on v${version.versionNumber}` },
        tx
      );
      await notify(
        {
          projectId,
          audience: "company",
          type: "revision_request.filed",
          message: `Client requested a rework on formulation version ${version.versionNumber}.`,
          link: `/formulation-versions/${params.id}`,
        },
        tx
      );

      return created;
    });

    return NextResponse.json({ revisionRequest }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
