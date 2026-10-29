import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { LeadStatusActions } from "./lead-status-actions";
import { ConvertLeadForm } from "./convert-lead-form";
import { ProposalSection } from "./proposal-section";
import { Shell } from "@/app/components/shell";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const user = await requireRoleOrRedirect(["ADMIN", "PROJECT_LEAD"]);

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) notFound();

  const convertedProject = lead.convertedToProjectId
    ? await prisma.project.findUnique({ where: { id: lead.convertedToProjectId }, select: { id: true, name: true } })
    : null;

  const projectLeads =
    user.role === "ADMIN" && lead.status !== "CONVERTED"
      ? await prisma.user.findMany({
          where: { role: "PROJECT_LEAD", active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  // 29 Oct 2026: Proposal workflow — confirmed with the user. Fetched for
  // every non-converted lead so the Proposals section and the
  // accepted-proposal gate on conversion (see lib/crm/proposals.ts) are
  // both visible here.
  const proposals =
    lead.status !== "CONVERTED"
      ? await prisma.proposal.findMany({
          where: { leadId: lead.id },
          include: {
            preparedBy: { select: { id: true, name: true } },
            reviewedBy: { select: { id: true, name: true } },
          },
          orderBy: [{ versionNumber: "desc" }],
        })
      : [];
  const hasAcceptedProposal = proposals.some((p) => p.status === "ACCEPTED");

  return (
    <Shell user={user}>
      <p>
        <Link href="/leads">&larr; Leads</Link>
      </p>
      <h1>{lead.companyName}</h1>
      <p style={{ color: "#555" }}>
        {lead.contactName}
        {lead.email ? ` · ${lead.email}` : ""}
        {lead.phone ? ` · ${lead.phone}` : ""}
      </p>
      <p>
        Status: <strong>{lead.status}</strong>
      </p>
      {lead.notes ? <p style={{ color: "#555", whiteSpace: "pre-wrap" }}>{lead.notes}</p> : null}

      {lead.status === "CONVERTED" ? (
        <p style={{ marginTop: 16 }}>
          Converted to project:{" "}
          {convertedProject ? <Link href={`/projects/${convertedProject.id}`}>{convertedProject.name}</Link> : "—"}
        </p>
      ) : (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Update status</h2>
          <LeadStatusActions id={lead.id} status={lead.status as "OPEN" | "QUALIFIED" | "LOST"} />

          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Proposals</h2>
          <ProposalSection
            leadId={lead.id}
            proposals={proposals.map((p) => ({
              id: p.id,
              versionNumber: p.versionNumber,
              status: p.status,
              title: p.title,
              content: p.content,
              reviewNotes: p.reviewNotes,
              clientDecisionNotes: p.clientDecisionNotes,
              sentAt: p.sentAt ? p.sentAt.toISOString() : null,
              decidedAt: p.decidedAt ? p.decidedAt.toISOString() : null,
              preparedBy: p.preparedBy,
              reviewedBy: p.reviewedBy,
            }))}
          />

          {user.role === "ADMIN" ? (
            <>
              <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Convert to client &amp; project</h2>
              <p style={{ color: "#555", fontSize: ".9rem" }}>
                Creates a client organization named &quot;{lead.companyName}&quot;, a contact from this lead&apos;s
                details, and a new project under it — all in one step.
              </p>
              {!hasAcceptedProposal ? (
                <p style={{ color: "#b00020", fontSize: ".85rem" }}>
                  Locked: this lead needs an accepted proposal (see above) before it can be converted.
                </p>
              ) : null}
              <ConvertLeadForm leadId={lead.id} defaultProjectName={lead.companyName} projectLeads={projectLeads} />
            </>
          ) : null}
        </>
      )}
    </Shell>
  );
}
