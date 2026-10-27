import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "./new-project-form";

export default async function NewProjectPage() {
  await requireRoleOrRedirect(["ADMIN"]);

  const [clientOrgs, leads] = await Promise.all([
    prisma.clientOrganization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "PROJECT_LEAD", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 500 }}>
      <h1>New project</h1>
      {clientOrgs.length === 0 || leads.length === 0 ? (
        <p style={{ color: "#b00020" }}>
          You need at least one client organization and one active Project
          Lead account before creating a project. Add them under{" "}
          <a href="/clients">Clients</a> and <a href="/admin/users">Users</a>.
        </p>
      ) : (
        <NewProjectForm clientOrgs={clientOrgs} leads={leads} />
      )}
    </main>
  );
}
