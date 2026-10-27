import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

// Deny-by-default (baseline §4): every protected server component or route
// handler calls one of these explicitly. There is no middleware that
// protects routes implicitly — see the note in middleware note below for
// why, and never assume a page is safe just because it's nested under a
// protected-looking folder.

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Not permitted") {
    super(message);
  }
}

// For API route handlers — throws rather than redirecting, so the route can
// return a proper 401/403 JSON response.
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw new ForbiddenError();
  return user;
}

// For server components/pages — redirects to /login instead of throwing,
// since there's no JSON response to return.
export async function requireUserOrRedirect(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRoleOrRedirect(allowed: Role[]): Promise<SessionUser> {
  const user = await requireUserOrRedirect();
  if (!allowed.includes(user.role)) redirect("/forbidden");
  return user;
}

// Record-level scoping helpers — role alone is never enough (baseline §4).
// Every module that reads/writes a Project, ClientOrganization, or anything
// under them must check one of these before touching the record, in
// addition to the role check above.

export async function assertProjectAccess(user: SessionUser, projectId: string) {
  const { prisma } = await import("@/lib/prisma");

  if (user.role === "ADMIN") return; // org-wide by design (baseline §4 table)

  if (user.role === "CLIENT") {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientOrgId: true },
    });
    if (!project || project.clientOrgId !== user.clientOrgId) {
      throw new ForbiddenError("Not your organization's project");
    }
    return;
  }

  // PROJECT_LEAD / NPD_EXECUTIVE: must have an explicit assignment row.
  const assignment = await prisma.projectAssignment.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
  });
  if (!assignment) throw new ForbiddenError("Not assigned to this project");
}

// Page-component variant: redirects instead of throwing, matching
// requireRoleOrRedirect's convention for server components.
export async function assertProjectAccessOrRedirect(user: SessionUser, projectId: string): Promise<void> {
  try {
    await assertProjectAccess(user, projectId);
  } catch (err) {
    if (err instanceof ForbiddenError) redirect("/forbidden");
    throw err;
  }
}
