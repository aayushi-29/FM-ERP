import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound } from "@/lib/npd/scope";
import { assertExecutionUnlocked } from "@/lib/projects/execution-gate";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Decimal fields come in as strings, never JS numbers — Prisma accepts a
// decimal string directly and this avoids ever routing a quantity through
// floating-point arithmetic (baseline §7: "never use floating-point
// arithmetic for financial totals" — the same rule applies to recipe
// quantities that cost calculations will later multiply against).
const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number, e.g. \"12.5\"");

const createLineSchema = z.object({
  materialName: z.string().min(1).max(200),
  rawMaterialId: z.string().cuid().optional(),
  quantity: decimalString,
  unit: z.string().min(1).max(20),
  percentage: decimalString.optional(),
  technicalNotes: z.string().max(2000).optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (actor.role !== "ADMIN" && actor.role !== "NPD_EXECUTIVE") {
      throw new ForbiddenError("Only an NPD Executive or Admin can edit ingredient lines");
    }

    const version = await prisma.formulationVersion.findUnique({ where: { id: params.id } });
    if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(actor, projectId);
    await assertExecutionUnlocked(projectId);

    if (version.status !== "DRAFT") {
      throw new ForbiddenError("Ingredient lines can only be edited on a DRAFT version");
    }

    const json = await request.json().catch(() => null);
    const input = createLineSchema.parse(json);

    if (input.rawMaterialId) {
      const material = await prisma.rawMaterial.findUnique({ where: { id: input.rawMaterialId } });
      if (!material) return NextResponse.json({ error: "rawMaterialId does not exist" }, { status: 400 });
    }

    const line = await prisma.ingredientLine.create({
      data: { formulationVersionId: params.id, ...input },
    });

    return NextResponse.json({ line }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
