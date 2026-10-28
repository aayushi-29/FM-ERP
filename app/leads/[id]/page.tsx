import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { LeadStatusActions } from "./lead-status-actions";
import { ConvertLeadForm } from "./convert-lead-form";

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

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 700 }}>
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

          {user.role === "ADMIN" ? (
            <>
              <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Convert to client &amp; project</h2>
              <p style={{ color: "#555", fontSize: ".9rem" }}>
                Creates a client organization named &quot;{lead.companyName}&quot;, a contact from this lead&apos;s
                details, and a new project under it — all in one step.
              </p>
              <ConvertLeadForm leadId={lead.id} defaultProjectName={lead.companyName} projectLeads={projectLeads} />
            </>
          ) : null}
        </>
      )}
    </main>
  );
}
