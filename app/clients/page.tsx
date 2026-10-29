import Link from "next/link";
import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getVisibleClientOrgIds } from "@/lib/crm/scope";
import { NewClientForm } from "./new-client-form";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Clients" };

// Admin: full access. Project Lead: only orgs they're assigned to via a
// project (see lib/crm/scope.ts). Internal tooling, not the final themed UI.
export default async function ClientsPage() {
  const user = await requireRoleOrRedirect(["ADMIN", "PROJECT_LEAD"]);
  const visible = await getVisibleClientOrgIds(user);

  const clients = await prisma.clientOrganization.findMany({
    where: visible === "ALL" ? undefined : { id: { in: visible } },
    select: { id: true, name: true, _count: { select: { projects: true, contacts: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>Clients</h1>
      </div>
      {user.role === "PROJECT_LEAD" ? (
        <p className="fm-li-meta" style={{ marginBottom: 16 }}>
          Showing only organizations you&apos;re assigned to via a project.
        </p>
      ) : null}

      {clients.length === 0 ? (
        <p className="fm-empty">No client organizations yet.</p>
      ) : (
        <div className="fm-section-grid">
          {clients.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="glass glass-sm glass-card fm-entity-card">
              <div className="fm-entity-card-head">
                <h3>{c.name}</h3>
              </div>

              <div className="fm-entity-card-stats">
                <div className="fm-entity-card-stat">
                  <span className="fm-entity-card-stat-value">{c._count.projects}</span>
                  <span className="fm-entity-card-stat-label">Projects</span>
                </div>
                <div className="fm-entity-card-stat">
                  <span className="fm-entity-card-stat-value">{c._count.contacts}</span>
                  <span className="fm-entity-card-stat-label">Contacts</span>
                </div>
              </div>

              <span className="fm-entity-card-cta">Open →</span>
            </Link>
          ))}
        </div>
      )}

      {user.role === "ADMIN" ? (
        <div className="glass glass-sm glass-card fm-section" style={{ marginTop: 24, maxWidth: 420 }}>
          <h3>Add a client organization</h3>
          <NewClientForm />
        </div>
      ) : null}
    </Shell>
  );
}
