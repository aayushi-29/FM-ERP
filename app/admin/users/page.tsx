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

  const roleBadgeClass: Record<string, string> = {
    ADMIN: "fm-badge fm-badge-gold",
    PROJECT_LEAD: "fm-badge fm-badge-good",
    NPD_EXECUTIVE: "fm-badge",
    CLIENT: "fm-badge",
  };

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>Users</h1>
        <p>Admin-only. No self-registration — every account starts here.</p>
      </div>

      <div className="fm-section-grid">
        {users.map((u) => (
          <div key={u.id} className="glass glass-sm glass-card fm-entity-card" style={{ cursor: "default" }}>
            <div className="fm-entity-card-head">
              <div>
                <h3>{u.name}</h3>
                <p className="fm-li-meta">{u.email}</p>
              </div>
              <span className={roleBadgeClass[u.role] ?? "fm-badge"}>{u.role}</span>
            </div>

            <p className="fm-li-meta" style={{ margin: 0 }}>
              {u.clientOrg?.name ? `${u.clientOrg.name} · ` : ""}
              <span className={u.active ? "fm-badge fm-badge-good" : "fm-badge fm-badge-warn"}>
                {u.active ? "Active" : "Deactivated"}
              </span>
            </p>

            <UserActions id={u.id} active={u.active} />
          </div>
        ))}
      </div>

      <div className="glass glass-sm glass-card fm-section" style={{ marginTop: 24, maxWidth: 420 }}>
        <h3>Add a user</h3>
        <NewUserForm clientOrgs={clientOrgs} />
      </div>
    </Shell>
  );
}
