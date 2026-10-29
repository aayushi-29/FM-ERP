import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { assertClientOrgAccessOrRedirect } from "@/lib/crm/scope";
import { NewContactForm } from "./new-contact-form";
import { Shell } from "@/app/components/shell";

// Display-only lookup for the browser tab title — not an access check
// (the page body below still enforces that via assertClientOrgAccessOrRedirect).
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const client = await prisma.clientOrganization.findUnique({ where: { id: params.id }, select: { name: true } });
  return { title: client?.name ?? "Client" };
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await requireRoleOrRedirect(["ADMIN", "PROJECT_LEAD"]);
  await assertClientOrgAccessOrRedirect(user, params.id);

  const client = await prisma.clientOrganization.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      projects: {
        select: {
          id: true,
          name: true,
          status: true,
          targetDate: true,
          // 29 Oct 2026 (third pass): counts for the entity-card stat row.
          _count: { select: { tasks: true, milestones: true } },
        },
      },
    },
  });

  if (!client) notFound();

  const statusBadgeClass: Record<string, string> = {
    ACTIVE: "fm-badge fm-badge-good",
    ON_HOLD: "fm-badge fm-badge-gold",
    COMPLETED: "fm-badge",
    CANCELLED: "fm-badge fm-badge-warn",
  };

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>{client.name}</h1>
      </div>

      <div className="fm-section-grid">
        <div className="glass glass-sm glass-card fm-section">
          <h3>Projects</h3>
          {client.projects.length === 0 ? (
            <p className="fm-empty">None yet.</p>
          ) : (
            <div className="fm-section-grid">
              {client.projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="glass glass-sm glass-card fm-entity-card">
                  <div className="fm-entity-card-head">
                    <h3>{p.name}</h3>
                    <span className={statusBadgeClass[p.status] ?? "fm-badge"}>{p.status}</span>
                  </div>

                  <div className="fm-entity-card-stats">
                    <div className="fm-entity-card-stat">
                      <span className="fm-entity-card-stat-value">{p._count.tasks}</span>
                      <span className="fm-entity-card-stat-label">Tasks</span>
                    </div>
                    <div className="fm-entity-card-stat">
                      <span className="fm-entity-card-stat-value">{p._count.milestones}</span>
                      <span className="fm-entity-card-stat-label">Milestones</span>
                    </div>
                    <div className="fm-entity-card-stat">
                      <span className="fm-entity-card-stat-value">
                        {p.targetDate ? new Date(p.targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                      </span>
                      <span className="fm-entity-card-stat-label">Target</span>
                    </div>
                  </div>

                  <span className="fm-entity-card-cta">View project →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass glass-sm glass-card fm-section">
          <h3>Contacts</h3>
          {client.contacts.length === 0 ? (
            <p className="fm-empty">No contacts yet.</p>
          ) : (
            <ul>
              {client.contacts.map((c) => (
                <li key={c.id}>
                  {c.name}
                  {c.isPrimary ? <span className="fm-badge fm-badge-gold" style={{ marginLeft: 6 }}>Primary</span> : null}
                  <span className="fm-li-meta">
                    {c.email ? `${c.email}` : ""}
                    {c.email && c.phone ? " · " : ""}
                    {c.phone ? `${c.phone}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 14 }}>
            <NewContactForm clientOrgId={client.id} />
          </div>
        </div>
      </div>
    </Shell>
  );
}
