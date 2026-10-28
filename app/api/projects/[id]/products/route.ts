import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { logProjectActivity } from "@/lib/projects/activity";
import { assertExecutionUnlocked } from "@/lib/projects/execution-gate";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Products group formulations under a project. Client excluded entirely —
// their only NPD visibility is a single approved formulation version's
// summary (lib/npd/scope.ts), reached through its own route, not a product
// listing.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);
    await assertProjectAccess(user, params.id);

    const products = await prisma.product.findMany({
      where: { projectId: params.id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { formulations: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ products });
  } catch (err) {
    return errorResponse(err);
  }
}

// Admin + NPD Executive only — Project Lead's row is "review/approve", not
// "create" (see lib/npd/scope.ts).
const createProductSchema = z.object({ name: z.string().min(1).max(200) });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "NPD_EXECUTIVE"]);
    await assertProjectAccess(actor, params.id);
    await assertExecutionUnlocked(params.id);

    const json = await request.json().catch(() => null);
    const input = createProductSchema.parse(json);

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({ data: { projectId: params.id, name: input.name } });
      await logProjectActivity(
        { projectId: params.id, actorId: actor.id, summary: `Product added: ${created.name}` },
        tx
      );
      return created;
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
