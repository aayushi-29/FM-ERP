import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canReadCosting } from "@/lib/costing/scope";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canReadCosting(user.role)) throw new ForbiddenError("Not permitted");

    const costSheet = await prisma.costSheet.findUnique({
      where: { id: params.id },
      include: {
        formulationVersion: { select: { id: true, versionNumber: true, formulation: { select: { name: true } } } },
        createdBy: { select: { id: true, name: true } },
        supersedes: { select: { id: true, createdAt: true, costPerUnit: true } },
        supersededBy: { select: { id: true, createdAt: true, costPerUnit: true } },
      },
    });
    if (!costSheet) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(user, costSheet.projectId);

    return NextResponse.json({ costSheet });
  } catch (err) {
    return errorResponse(err);
  }
}
