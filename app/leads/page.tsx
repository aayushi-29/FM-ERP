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

  const statusBadgeClass: Record<string, string> = {
    OPEN: "fm-badge",
    QUALIFIED: "fm-badge fm-badge-gold",
    CONVERTED: "fm-badge fm-badge-good",
    LOST: "fm-badge fm-badge-warn",
  };

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>Leads</h1>
        <p>
          The sales pipeline, before a company becomes a client organization. Converting a lead creates its
          client organization and first project in one step.
        </p>
      </div>

      {leads.length === 0 ? (
        <p className="fm-empty">No leads yet.</p>
      ) : (
        <div className="fm-section-grid">
          {leads.map((l) => (
            <Link key={l.id} href={`/leads/${l.id}`} className="glass glass-sm glass-card fm-entity-card">
              <div className="fm-entity-card-head">
                <div>
                  <h3>{l.companyName}</h3>
                  <p className="fm-li-meta">
                    {l.contactName}
                    {l.email ? ` · ${l.email}` : ""}
                  </p>
                </div>
                <span className={statusBadgeClass[l.status] ?? "fm-badge"}>{l.status}</span>
              </div>

              <span className="fm-entity-card-cta">Open →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="glass glass-sm glass-card fm-section" style={{ marginTop: 24, maxWidth: 420 }}>
        <h3>Add a lead</h3>
        <NewLeadForm />
      </div>
    </Shell>
  );
}
