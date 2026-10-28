import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, assertProjectAccess } from "@/lib/auth/rbac";
import { getProjectIdForFormulationVersion, assertFound } from "@/lib/npd/scope";
import { logProjectActivity } from "@/lib/projects/activity";
import { assertExecutionUnlocked } from "@/lib/projects/execution-gate";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Baseline §4 permission matrix, Trials row: "Admin: Authorized access" /
// "Project Lead: Read assigned projects" / "NPD Executive: Create/update
// assigned trials" / "Client: No access by default" (so Client is excluded
// from this route entirely, not given a reduced view).
//
// Interpretation flag: the matrix's "assigned trials" for NPD Executive
// clearly restricts *create/update* to trials that executive conducted
// (enforced in /api/trials/[id] and the POST handler below), but it says
// nothing about whether an NPD Executive may *see* a colleague's trial on
// the same formulation version. We read the Project Lead's "Read assigned
// projects" as the model for shared visibility and extend read access to
// any role already permitted into the project (Admin/Project
// Lead/NPD Executive) — a trial log is most useful as a shared record of
// what's been tried, and restricting reads to "my own trials only" would
// make an NPD Executive unable to see whether a colleague already ran the
// trial they're about to duplicate. If Food Monk wants trial visibility
// restricted to the conducting executive, narrow the GET handler's `where`
// clause to add `conductedById: actor.role === "NPD_EXECUTIVE" ? actor.id
// : undefined`.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);
    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(user, projectId);

    const trials = await prisma.trial.findMany({
      where: { formulationVersionId: params.id },
      orderBy: { conductedAt: "desc" },
    });

    return NextResponse.json({ trials });
  } catch (err) {
    return errorResponse(err);
  }
}

const createTrialSchema = z.object({
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETE"]).optional(),
  parameters: z.string().max(4000).optional(),
  results: z.string().max(4000).optional(),
  materialLotUsed: z.string().max(200).optional(),
  quantityConsumed: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  // Admin may log a trial on another executive's behalf and name the
  // conductor explicitly; an NPD Executive is always recorded as the
  // conductor of their own trial, regardless of what's posted.
  conductedById: z.string().cuid().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "NPD_EXECUTIVE"]);
    const projectId = assertFound(await getProjectIdForFormulationVersion(params.id), "Not found");
    await assertProjectAccess(actor, projectId);
    await assertExecutionUnlocked(projectId);

    const json = await request.json().catch(() => null);
    const input = createTrialSchema.parse(json);

    const conductedById = actor.role === "NPD_EXECUTIVE" ? actor.id : input.conductedById ?? actor.id;

    if (conductedById !== actor.id) {
      const conductor = await prisma.user.findUnique({ where: { id: conductedById } });
      if (!conductor) {
        return NextResponse.json({ error: "conductedById does not exist" }, { status: 400 });
      }
    }

    const trial = await prisma.$transaction(async (tx) => {
      const created = await tx.trial.create({
        data: {
          formulationVersionId: params.id,
          conductedById,
          status: input.status,
          parameters: input.parameters,
          results: input.results,
          materialLotUsed: input.materialLotUsed,
          quantityConsumed: input.quantityConsumed,
        },
      });
      await logProjectActivity(
        { projectId, actorId: actor.id, summary: "Trial logged" },
        tx
      );
      return created;
    });

    return NextResponse.json({ trial }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
