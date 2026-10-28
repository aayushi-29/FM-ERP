import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { logProjectActivity } from "@/lib/projects/activity";
import { isSameOrigin } from "@/lib/security/origin";
import { errorResponse, ValidationError } from "@/lib/api/respond";
import { assertLeadHasAcceptedProposal } from "@/lib/crm/proposals";

// Baseline §6.1. Admin-only: this is the one place a Lead turns into real
// records — a new ClientOrganization, a ClientContact seeded from the
// lead's contact details, and a Project (which itself is Admin-only to
// create, per app/api/projects/route.ts) — so conversion inherits that
// same restriction rather than opening a second, looser door onto Project
// creation. Everything lands in one transaction: a lead marked CONVERTED
// with no Project behind it (or the reverse) is exactly the kind of drift
// the baseline's "operations that must succeed or fail together use one
// transaction" rule (§7) exists to prevent.
const convertLeadSchema = z.object({
  projectName: z.string().min(1).max(200),
  leadId: z.string().cuid(), // the Project Lead user to assign — unrelated to this route's own [id] param
  scope: z.string().max(4000).optional(),
  targetDate: z.string().datetime().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    const actor = await requireRole(["ADMIN"]);
    const json = await request.json().catch(() => null);
    const input = convertLeadSchema.parse(json);

    const lead = await prisma.lead.findUnique({ where: { id: params.id } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (lead.status === "CONVERTED") {
      throw new ValidationError("This lead has already been converted");
    }

    // Confirmed with the user (29 Oct 2026): conversion now requires an
    // ACCEPTED Proposal on this lead — see lib/crm/proposals.ts.
    await assertLeadHasAcceptedProposal(lead.id);

    const projectLead = await prisma.user.findUnique({ where: { id: input.leadId } });
    if (!projectLead || projectLead.role !== "PROJECT_LEAD" || !projectLead.active) {
      return NextResponse.json(
        { error: "leadId must be an active user with the Project Lead role" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const clientOrg = await tx.clientOrganization.create({ data: { name: lead.companyName } });

      const contact = await tx.clientContact.create({
        data: {
          clientOrgId: clientOrg.id,
          name: lead.contactName,
          email: lead.email,
          phone: lead.phone,
          isPrimary: true,
        },
      });

      const project = await tx.project.create({
        data: {
          name: input.projectName,
          clientOrgId: clientOrg.id,
          leadId: input.leadId,
          scope: input.scope,
          targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        },
      });

      await tx.projectAssignment.create({ data: { userId: input.leadId, projectId: project.id } });

      const convertedLead = await tx.lead.update({
        where: { id: params.id },
        data: { status: "CONVERTED", convertedToProjectId: project.id },
      });

      await logAudit(
        {
          actorId: actor.id,
          action: "LEAD_CONVERTED",
          targetType: "Lead",
          targetId: lead.id,
          before: { status: lead.status },
          after: { status: "CONVERTED", clientOrgId: clientOrg.id, projectId: project.id },
        },
        tx
      );
      await logProjectActivity(
        { projectId: project.id, actorId: actor.id, summary: `Project created from converted lead "${lead.companyName}"` },
        tx
      );

      return { lead: convertedLead, clientOrg, contact, project };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
