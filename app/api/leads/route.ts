import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse } from "@/lib/api/respond";

// Baseline §4's "Clients / CRM" row (Admin full access, Project Lead
// assigned/authorized clients, everyone else no access) doesn't quite fit
// a Lead: a Lead has no ClientOrganization and no Project yet, so there's
// nothing for ProjectAssignment to scope. Interpretation flag: every
// Admin and Project Lead can see and work the whole lead pipeline — a
// Lead isn't "someone's" client org until it's converted, so there's no
// natural per-lead boundary to draw before that point. Flag this to Food
// Monk if the sales pipeline should be split up some other way (by
// territory, by who logged it, etc.) — it's a one-place change here.
const createLeadSchema = z.object({
  companyName: z.string().min(1).max(200),
  contactName: z.string().min(1).max(200),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  notes: z.string().max(4000).optional(),
});

export async function GET() {
  try {
    await requireRole(["ADMIN", "PROJECT_LEAD"]);

    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ leads });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN", "PROJECT_LEAD"]);
    const json = await request.json().catch(() => null);
    const input = createLeadSchema.parse(json);

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          companyName: input.companyName,
          contactName: input.contactName,
          email: input.email,
          phone: input.phone,
          notes: input.notes,
        },
      });
      await logAudit(
        {
          actorId: actor.id,
          action: "LEAD_CREATED",
          targetType: "Lead",
          targetId: created.id,
          after: { companyName: created.companyName, contactName: created.contactName },
        },
        tx
      );
      return created;
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
