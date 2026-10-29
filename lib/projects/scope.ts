import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";

// "Projects & tasks" row, baseline §4: Admin org-wide; Project Lead
// assigned projects; NPD Executive assigned tasks/projects; Client own
// projects. assertProjectAccess (lib/auth/rbac.ts) checks one record; this
// is the matching list-scope for "which project IDs can this user see at
// all" — used by GET /api/projects and any page listing projects.
export async function getVisibleProjectIds(user: SessionUser): Promise<string[] | "ALL"> {
  if (user.role === "ADMIN") return "ALL";

  if (user.role === "CLIENT") {
    if (!user.clientOrgId) return [];
    const projects = await prisma.project.findMany({
      where: { clientOrgId: user.clientOrgId },
      select: { id: true },
    });
    return projects.map((p) => p.id);
  }

  // PROJECT_LEAD / NPD_EXECUTIVE: scoped by an explicit ProjectAssignment
  // row. A Project Lead gets one automatically when they're set as a
  // project's lead (see app/api/projects/route.ts) — there's no separate
  // "is the designated lead" check here, by design: ProjectAssignment is
  // the single source of truth for "can this person see this project."
  const assignments = await prisma.projectAssignment.findMany({
    where: { userId: user.id },
    select: { projectId: true },
  });
  return assignments.map((a) => a.projectId);
}

// Fields a CLIENT is allowed to see on a Project — baseline §4: "Own
// projects; approved fields" for the Projects & tasks row. Internal
// planning text (`scope`) and the task/activity breakdown are treated as
// internal-only; a client sees status, dates, and who to contact. This is
// an interpretation (same caveat as lib/crm/scope.ts) — easy to widen or
// narrow here, in one place, once Food Monk confirms what "approved
// fields" should mean in practice.
export const CLIENT_SAFE_PROJECT_SELECT = {
  id: true,
  name: true,
  status: true,
  targetDate: true,
  createdAt: true,
  lead: { select: { name: true, email: true } },
  // So the Client-facing project page can show the same "advance not yet
  // verified" banner as the internal view — a timestamp, not a sensitive
  // financial figure, so it's safe in the client-safe select.
  advancePaymentVerifiedAt: true,
  // 29 Oct 2026 (third pass): counts only, for the entity-card stat row on
  // the Projects list — no task/milestone content, just how many, which
  // isn't internal planning detail.
  _count: { select: { tasks: true, milestones: true } },
} as const;
