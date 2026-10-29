import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getVisibleClientOrgIds } from "@/lib/crm/scope";
import { NewClientForm } from "./new-client-form";
import { Shell } from "@/app/components/shell";

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
      <h1>Clients</h1>
      {user.role === "PROJECT_LEAD" ? (
        <p style={{ color: "#555" }}>Showing only organizations you&apos;re assigned to via a project.</p>
      ) : null}

      {clients.length === 0 ? (
        <p>No client organizations yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {clients.map((c) => (
            <li key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <Link href={`/clients/${c.id}`}>{c.name}</Link>
              <span style={{ color: "#777", fontSize: ".85rem", marginLeft: 8 }}>
                {c._count.projects} project{c._count.projects === 1 ? "" : "s"} · {c._count.contacts} contact{c._count.contacts === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {user.role === "ADMIN" ? (
        <>
          <h2 style={{ marginTop: 32, fontSize: "1.1rem" }}>Add a client organization</h2>
          <NewClientForm />
        </>
      ) : null}
    </Shell>
  );
}
