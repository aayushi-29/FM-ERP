import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { getProjectIdForProduct, assertFound } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);
    const projectId = assertFound(await getProjectIdForProduct(params.id), "Product not found");
    await assertProjectAccess(user, projectId);

    const formulations = await prisma.formulation.findMany({
      where: { productId: params.id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        versions: {
          select: { id: true, versionNumber: true, status: true, createdAt: true },
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ formulations });
  } catch (err) {
    return errorResponse(err);
  }
}

// Creating a Formulation always creates its version 1 as DRAFT in the same
// transaction (baseline §6.3 step 1: "Create a product/formulation draft
// under an authorized project") — a Formulation with zero versions isn't
// a meaningful object on its own.
const createFormulationSchema = z.object({
  name: z.string().min(1).max(200),
  processNotes: z.string().max(4000).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "NPD_EXECUTIVE"]);
    const projectId = assertFound(await getProjectIdForProduct(params.id), "Product not found");
    await assertProjectAccess(actor, projectId);

    const json = await request.json().catch(() => null);
    const input = createFormulationSchema.parse(json);

    const formulation = await prisma.$transaction(async (tx) => {
      const created = await tx.formulation.create({ data: { productId: params.id, name: input.name } });
      const version = await tx.formulationVersion.create({
        data: {
          formulationId: created.id,
          versionNumber: 1,
          status: "DRAFT",
          authorId: actor.id,
          processNotes: input.processNotes,
        },
      });
      await logProjectActivity(
        { projectId, actorId: actor.id, summary: `Formulation drafted: ${created.name} (v1)` },
        tx
      );
      return { ...created, firstVersionId: version.id };
    });

    return NextResponse.json({ formulation }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
