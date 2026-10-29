import Link from "next/link";
import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { NewLeadForm } from "./new-lead-form";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Leads" };

// Admin + Project Lead, both full access to the whole pipeline — see the
// interpretation flag in app/api/leads/route.ts for why there's no
// per-lead scoping here (a Lead predates any ClientOrganization/Project
// to scope by). Internal tooling, not the final themed UI.
export default async function LeadsPage() {
  const user = await requireRoleOrRedirect(["ADMIN", "PROJECT_LEAD"]);

  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <Shell user={user}>
      <h1>Leads</h1>
      <p style={{ color: "#555" }}>
        The sales pipeline, before a company becomes a client organization. Converting a lead creates its
        client organization and first project in one step.
      </p>

      {leads.length === 0 ? (
        <p>No leads yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: ".9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "6px 8px" }}>Company</th>
              <th style={{ padding: "6px 8px" }}>Contact</th>
              <th style={{ padding: "6px 8px" }}>Status</th>
              <th style={{ padding: "6px 8px" }}></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "6px 8px" }}>{l.companyName}</td>
                <td style={{ padding: "6px 8px" }}>
                  {l.contactName}
                  {l.email ? <span style={{ color: "#888" }}> · {l.email}</span> : null}
                </td>
                <td style={{ padding: "6px 8px" }}>{l.status}</td>
                <td style={{ padding: "6px 8px" }}>
                  <Link href={`/leads/${l.id}`}>Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 32, fontSize: "1.1rem" }}>Add a lead</h2>
      <NewLeadForm />
    </Shell>
  );
}
