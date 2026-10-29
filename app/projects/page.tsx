import Link from "next/link";
import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { getVisibleProjectIds, CLIENT_SAFE_PROJECT_SELECT } from "@/lib/projects/scope";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const user = await requireUserOrRedirect();
  const visible = await getVisibleProjectIds(user);
  const where = visible === "ALL" ? undefined : { id: { in: visible } };

  const projects =
    user.role === "CLIENT"
      ? await prisma.project.findMany({ where, select: CLIENT_SAFE_PROJECT_SELECT })
      : await prisma.project.findMany({
          where,
          select: {
            id: true,
            name: true,
            status: true,
            targetDate: true,
            clientOrg: { select: { name: true } },
            lead: { select: { name: true } },
            // 29 Oct 2026 (third pass): counts for the entity-card stat row.
            _count: { select: { tasks: true, milestones: true } },
          },
          orderBy: { createdAt: "desc" },
        });

  const statusBadgeClass: Record<string, string> = {
    ACTIVE: "fm-badge fm-badge-good",
    ON_HOLD: "fm-badge fm-badge-gold",
    COMPLETED: "fm-badge",
    CANCELLED: "fm-badge fm-badge-warn",
  };

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>Projects</h1>
        {user.role === "ADMIN" ? (
          <Link href="/projects/new" className="fm-badge fm-badge-gold">
            + New project
          </Link>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <p className="fm-empty">No projects yet.</p>
      ) : (
        <div className="fm-section-grid">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="glass glass-sm glass-card fm-entity-card">
              <div className="fm-entity-card-head">
                <div>
                  <h3>{p.name}</h3>
                  <p className="fm-li-meta">
                    {"clientOrg" in p && p.clientOrg ? p.clientOrg.name : ""}
                    {"lead" in p && p.lead ? ` · led by ${p.lead.name}` : ""}
                  </p>
                </div>
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
    </Shell>
  );
}
