import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/auth/rbac";

// Baseline §4 permission matrix, "Clients / CRM" row:
//   Admin           — full access
//   Project Lead    — assigned/authorized clients
//   NPD Executive   — no access by default
//   Client          — no access by default (a client sees their own
//                     projects directly; they don't get a client directory)
//
// "Assigned/authorized" isn't defined further in the baseline, so this is
// an interpretation, not a confirmed decision like the numbered 12: a
// Project Lead can see and manage CONTACTS for a client organization only
// if they're assigned to at least one of that org's projects (via
// ProjectAssignment) — the same assignment relation that scopes their
// Projects/Tasks access. Renaming the organization itself, or creating a
// new one, stays Admin-only. Flag this interpretation to Food Monk; it's
// easy to tighten or loosen later since every query runs through here.

export async function getVisibleClientOrgIds(user: SessionUser): Promise<string[] | "ALL"> {
  if (user.role === "ADMIN") return "ALL";

  if (user.role === "PROJECT_LEAD") {
    const projects = await prisma.project.findMany({
      where: { assignments: { some: { userId: user.id } } },
      select: { clientOrgId: true },
      distinct: ["clientOrgId"],
    });
    return projects.map((p) => p.clientOrgId);
  }

  // NPD_EXECUTIVE and CLIENT: no CRM directory access by default.
  return [];
}

export async function assertClientOrgAccess(user: SessionUser, clientOrgId: string): Promise<void> {
  const visible = await getVisibleClientOrgIds(user);
  if (visible === "ALL") return;
  if (!visible.includes(clientOrgId)) {
    throw new ForbiddenError("Not an authorized client organization");
  }
}

// Page-component variant: redirects instead of throwing, matching
// requireRoleOrRedirect's convention for server components.
export async function assertClientOrgAccessOrRedirect(user: SessionUser, clientOrgId: string): Promise<void> {
  try {
    await assertClientOrgAccess(user, clientOrgId);
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/forbidden");
    throw err;
  }
}
