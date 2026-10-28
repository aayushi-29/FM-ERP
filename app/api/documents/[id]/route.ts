import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, assertProjectAccess, ForbiddenError } from "@/lib/auth/rbac";
import { canManageVisibility } from "@/lib/documents/scope";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();

    const document = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        uploadedBy: { select: { id: true, name: true } },
        versions: { orderBy: { versionNumber: "desc" } },
      },
    });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(user, document.projectId);

    if (user.role === "CLIENT" && document.visibility !== "CLIENT_VISIBLE") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (err) {
    return errorResponse(err);
  }
}

// "Manage visibility and access" (Admin) / "Manage authorized project
// documents" (Project Lead) — the only two roles that can reclassify a
// document after upload. Changing type OR visibility is audited either
// way, since a visibility flip is exactly the kind of action baseline §10
// calls out ("what record/version was affected").
const updateSchema = z.object({
  type: z.enum(["CONTRACT", "TECHNICAL_SPEC", "FORMULATION_SUMMARY", "TRIAL_RECORD", "COMMERCIAL", "OTHER"]).optional(),
  visibility: z.enum(["INTERNAL_ONLY", "CLIENT_VISIBLE"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireUser();
    if (!canManageVisibility(actor.role)) {
      throw new ForbiddenError("Only an Admin or Project Lead can change a document's type or visibility");
    }

    const document = await prisma.document.findUnique({ where: { id: params.id } });
    if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await assertProjectAccess(actor, document.projectId);

    const input = updateSchema.parse(await request.json().catch(() => null));

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.document.update({
        where: { id: params.id },
        data: { type: input.type, visibility: input.visibility },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "document.updated",
          targetType: "Document",
          targetId: params.id,
          before: { type: document.type, visibility: document.visibility },
          after: { type: result.type, visibility: result.visibility },
        },
        tx
      );
      return result;
    });

    return NextResponse.json({ document: updated });
  } catch (err) {
    return errorResponse(err);
  }
}
