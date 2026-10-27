import { notFound } from "next/navigation";
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

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 700 }}>
      <h1>{client.name}</h1>

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Projects</h2>
      {client.projects.length === 0 ? (
        <p style={{ color: "#777" }}>None yet — the Projects module isn&apos;t built yet.</p>
      ) : (
        <ul>
          {client.projects.map((p) => (
            <li key={p.id}>{p.name} — {p.status}</li>
          ))}
        </ul>
      )}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Contacts</h2>
      {client.contacts.length === 0 ? (
        <p style={{ color: "#777" }}>No contacts yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {client.contacts.map((c) => (
            <li key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee" }}>
              {c.name}{c.isPrimary ? " (primary)" : ""}
              {c.email ? ` · ${c.email}` : ""}
              {c.phone ? ` · ${c.phone}` : ""}
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ fontSize: ".95rem", marginTop: 20 }}>Add a contact</h3>
      <NewContactForm clientOrgId={client.id} />
    </main>
  );
}
