import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { NewUserForm } from "./new-user-form";
import { UserActions } from "./user-actions";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Users" };

// Internal tooling, not the themed role dashboard promised for step 5 of
// the build order — functional, unstyled-on-purpose, so it doesn't get
// mistaken for finished UI.
export default async function AdminUsersPage() {
  const user = await requireRoleOrRedirect(["ADMIN"]);

  const [users, clientOrgs] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, active: true, clientOrg: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.clientOrganization.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <Shell user={user}>
      <h1>Users</h1>
      <p style={{ color: "#555" }}>Admin-only. No self-registration — every account starts here.</p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16, fontSize: ".9rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th style={{ padding: "6px 8px" }}>Name</th>
            <th style={{ padding: "6px 8px" }}>Email</th>
            <th style={{ padding: "6px 8px" }}>Role</th>
            <th style={{ padding: "6px 8px" }}>Client org</th>
            <th style={{ padding: "6px 8px" }}>Status</th>
            <th style={{ padding: "6px 8px" }}></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 8px" }}>{u.name}</td>
              <td style={{ padding: "6px 8px" }}>{u.email}</td>
              <td style={{ padding: "6px 8px" }}>{u.role}</td>
              <td style={{ padding: "6px 8px" }}>{u.clientOrg?.name ?? "—"}</td>
              <td style={{ padding: "6px 8px" }}>{u.active ? "Active" : "Deactivated"}</td>
              <td style={{ padding: "6px 8px" }}><UserActions id={u.id} active={u.active} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ marginTop: 32, fontSize: "1.1rem" }}>Add a user</h2>
      <NewUserForm clientOrgs={clientOrgs} />
    </Shell>
  );
}
