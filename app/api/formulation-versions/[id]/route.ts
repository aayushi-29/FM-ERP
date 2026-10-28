import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound, CLIENT_SAFE_VERSION_SELECT } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(user, projectId);

    if (user.role === "CLIENT") {
      // "Approved summary only" (baseline §4) — both a reduced field set
      // AND gated on status: a Client never sees a Draft/In Review/
      // Rejected version at all, approved or not yet.
      const version = await prisma.formulationVersion.findUnique({
        where: { id: params.id, status: "APPROVED" },
        select: CLIENT_SAFE_VERSION_SELECT,
      });
      if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ version });
    }

    const version = await prisma.formulationVersion.findUnique({
      where: { id: params.id },
      include: {
        formulation: { select: { id: true, name: true, product: { select: { id: true, name: true } } } },
        author: { select: { id: true, name: true } },
        ingredientLines: true,
        trials: {
          select: { id: true, status: true, conductedById: true, conductedAt: true, parameters: true, results: true },
          orderBy: { conductedAt: "desc" },
        },
        approvals: { include: { approver: { select: { id: true, name: true } } }, orderBy: { decidedAt: "desc" } },
        previousVersion: { select: { id: true, versionNumber: true, status: true } },
        nextVersions: { select: { id: true, versionNumber: true, status: true } },
      },
    });
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ version });
  } catch (err) {
    return errorResponse(err);
  }
}

// Editing (processNotes) and submitting for review are both NPD
// Executive/Admin actions, restricted to a still-DRAFT version — once
// submitted (or decided), this route refuses further edits. There's no
// "recall from review" action in the baseline; a rejected version is
// revised into a new one instead (see the /revise route).
const patchSchema = z.object({
  processNotes: z.string().max(4000).optional(),
  submit: z.boolean().optional(), // true => DRAFT -> IN_REVIEW
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (actor.role !== "ADMIN" && actor.role !== "NPD_EXECUTIVE") {
      throw new ForbiddenError("Only an NPD Executive or Admin can edit a formulation draft");
    }

    const version = await prisma.formulationVersion.findUnique({ where: { id: params.id } });
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(actor, projectId);

    if (version.status !== "DRAFT") {
      throw new ForbiddenError(
        version.status === "IN_REVIEW"
          ? "This version is already submitted for review"
          : "This version has already been decided — revise it to create a new draft"
      );
    }

    const json = await request.json().catch(() => null);
    const input = patchSchema.parse(json);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.formulationVersion.update({
        where: { id: params.id },
        data: {
          processNotes: input.processNotes,
          status: input.submit ? "IN_REVIEW" : undefined,
          submittedAt: input.submit ? new Date() : undefined,
        },
      });
      if (input.submit) {
        await logProjectActivity(
          { projectId, actorId: actor.id, summary: `Formulation v${result.versionNumber} submitted for review` },
          tx
        );
      }
      return result;
    });

    return NextResponse.json({ version: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
