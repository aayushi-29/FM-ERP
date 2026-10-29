import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { assertClientOrgAccessOrRedirect } from "@/lib/crm/scope";
import { NewContactForm } from "./new-contact-form";

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const user = await requireRoleOrRedirect(["ADMIN", "PROJECT_LEAD"]);
  await assertClientOrgAccessOrRedirect(user, params.id);

  const client = await prisma.clientOrganization.findUnique({
    where: { id: params.id },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      projects: { select: { id: true, name: true, status: true } },
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
    <main>
      <div className="fm-page-head">
        <h1>{client.name}</h1>
      </div>

      <div className="fm-section-grid">
        <div className="glass glass-sm glass-card fm-section">
          <h3>Projects</h3>
          {client.projects.length === 0 ? (
            <p className="fm-empty">None yet.</p>
          ) : (
            <ul>
              {client.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`}>{p.name}</Link>{" "}
                  <span className={statusBadgeClass[p.status] ?? "fm-badge"}>{p.status}</span>
                </li>
              ))}
            </ul>
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
    </main>
  );
}
