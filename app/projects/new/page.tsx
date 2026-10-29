import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { NewProjectForm } from "./new-project-form";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "New Project" };

export default async function NewProjectPage() {
  const user = await requireRoleOrRedirect(["ADMIN"]);

  const [clientOrgs, leads] = await Promise.all([
    prisma.clientOrganization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: "PROJECT_LEAD", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <Shell user={user}>
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
    </Shell>
  );
}
