import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound } from "@/lib/npd/scope";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

const decimalString = z.string().regex(/^\d+(\.\d+)?$/, "Must be a plain decimal number, e.g. \"12.5\"");

const updateLineSchema = z.object({
  materialName: z.string().min(1).max(200).optional(),
  quantity: decimalString.optional(),
  unit: z.string().min(1).max(20).optional(),
  percentage: decimalString.nullable().optional(),
  technicalNotes: z.string().max(2000).nullable().optional(),
});

async function assertEditable(actorRole: string, formulationVersionId: string) {
  if (actorRole !== "ADMIN" && actorRole !== "NPD_EXECUTIVE") {
    throw new ForbiddenError("Only an NPD Executive or Admin can edit ingredient lines");
  }
  const version = await prisma.formulationVersion.findUnique({ where: { id: formulationVersionId } });
  if (!version) throw new ForbiddenError("Not found");
  if (version.status !== "DRAFT") {
    throw new ForbiddenError("Ingredient lines can only be edited on a DRAFT version");
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    const line = await prisma.ingredientLine.findUnique({ where: { id: params.id } });
    if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectId = assertFound(
      await getProjectIdForFormulationVersion(line.formulationVersionId),
      "Not found"
    );
    await assertProjectAccess(actor, projectId);
    await assertEditable(actor.role, line.formulationVersionId);

    const json = await request.json().catch(() => null);
    const input = updateLineSchema.parse(json);

    const updated = await prisma.ingredientLine.update({ where: { id: params.id }, data: input });
    return NextResponse.json({ line: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    const line = await prisma.ingredientLine.findUnique({ where: { id: params.id } });
    if (!line) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectId = assertFound(
      await getProjectIdForFormulationVersion(line.formulationVersionId),
      "Not found"
    );
    await assertProjectAccess(actor, projectId);
    await assertEditable(actor.role, line.formulationVersionId);

    await prisma.ingredientLine.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
