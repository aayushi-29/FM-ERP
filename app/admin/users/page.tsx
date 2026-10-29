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

  // 29 Oct 2026 (fourth pass): "there should be columns for admin, lead,
  // npd, client and they should be segregated in those columns" —
  // confirmed with the user. Fixed order/labels so every column shows
  // even when empty, rather than columns appearing/disappearing as the
  // user list changes.
  const ROLE_COLUMNS: { role: "ADMIN" | "PROJECT_LEAD" | "NPD_EXECUTIVE" | "CLIENT"; label: string }[] = [
    { role: "ADMIN", label: "Admin" },
    { role: "PROJECT_LEAD", label: "Project Lead" },
    { role: "NPD_EXECUTIVE", label: "NPD Executive" },
    { role: "CLIENT", label: "Client" },
  ];

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>Users</h1>
        <p>Admin-only. No self-registration — every account starts here.</p>
      </div>

      <div className="glass glass-sm glass-card fm-section" style={{ marginBottom: 24, maxWidth: 420 }}>
        <h3>Add a user</h3>
        <NewUserForm clientOrgs={clientOrgs} />
      </div>

      <div className="fm-role-columns">
        {ROLE_COLUMNS.map(({ role, label }) => {
          const inRole = users.filter((u: (typeof users)[number]) => u.role === role);
          return (
            <div key={role}>
              <div className="fm-role-column-head">
                <h3>{label}</h3>
                <span className="fm-role-column-count">{inRole.length}</span>
              </div>
              <div className="fm-role-column-cards">
                {inRole.length === 0 ? (
                  <p className="fm-empty">None yet.</p>
                ) : (
                  inRole.map((u) => (
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
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}
