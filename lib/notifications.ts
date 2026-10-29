import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type DbClient = typeof prisma | Prisma.TransactionClient;

// In-app notifications only — no email/SMS infra exists or is being built
// on this branch. "It should show notifications for client and company
// both" (payment events) is read as: every Admin, the project's assigned
// Project Lead and NPD Executive(s) count as "company"; every active
// CLIENT user belonging to the project's ClientOrganization counts as
// "client". Resolved fresh on every call rather than cached, since
// assignments and client-org membership can change between notifications.
async function resolveCompanyRecipientIds(projectId: string, db: DbClient): Promise<string[]> {
  const [admins, project, assignments] = await Promise.all([
    db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } }),
    db.project.findUnique({ where: { id: projectId }, select: { leadId: true } }),
    db.projectAssignment.findMany({ where: { projectId }, select: { userId: true } }),
  ]);

  const ids = new Set<string>(admins.map((u) => u.id));
  if (project?.leadId) ids.add(project.leadId);
  for (const a of assignments) ids.add(a.userId);
  return Array.from(ids);
}

async function resolveClientRecipientIds(projectId: string, db: DbClient): Promise<string[]> {
  const project = await db.project.findUnique({ where: { id: projectId }, select: { clientOrgId: true } });
  if (!project) return [];
  const clientUsers = await db.user.findMany({
    where: { role: "CLIENT", active: true, clientOrgId: project.clientOrgId },
    select: { id: true },
  });
  return clientUsers.map((u) => u.id);
}

// 29 Oct 2026 (fourth pass): confidentiality fix, confirmed with the
// user — "the notification should go to the relatable person only, not to
// everyone; a client payment should go to admin". "company" (below)
// resolves to every project member regardless of role, including an NPD
// Executive assigned to the project — but NPD Executive "has no access" to
// Costing/Invoices at all (README's permission matrix). Routing a payment
// claim or invoice notification through "company" was therefore handing
// financial detail (amounts, claim status) to a role with no read access
// to that data.
//
// 29 Oct 2026 (fourth pass, follow-up): originally this also included the
// project's Lead, on the theory that Project Lead could "read authorized
// projects" worth of Costing/Invoices per the baseline matrix. Narrowed
// further per the user: "admin pays to npd and lead, so they should not
// know what is actually happening with payment data... he should not have
// the project budget idea" — Project Lead can still see the production
// cost breakdown (materials, making charge, overhead — unchanged,
// lib/costing/scope.ts's canReadCosting), just not what the client is
// actually being charged or has paid. So "finance" is now Admin only —
// the one role that can act on payments at all (canManageInvoices).
async function resolveFinanceRecipientIds(_projectId: string, db: DbClient): Promise<string[]> {
  const admins = await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  return admins.map((u: { id: string }) => u.id);
}

// Writes one Notification row per resolved recipient. `audience` picks who
// gets it:
//   "company"         — Admins + the assigned Project Lead/NPD Executives.
//                        For operational events everyone on the project
//                        legitimately needs to know about (execution
//                        unlocked, a rework requested) — never for anything
//                        that reveals a financial figure to NPD Executive.
//   "client"           — active Client users in the project's org.
//   "both"              — company + client.
//   "finance"           — Admin only (see resolveFinanceRecipientIds
//                         above) — payment claims, invoice amounts, and
//                         anything else that reveals what the client is
//                         being charged or has paid. Neither NPD Executive
//                         nor Project Lead has read access to this.
//   "financeAndClient"  — finance + client.
// Pass `db` as a transaction client so these commit atomically with the
// event they describe, same convention as logAudit/logProjectActivity.
export async function notify(
  entry: {
    projectId: string;
    audience: "company" | "client" | "both" | "finance" | "financeAndClient";
    type: string;
    message: string;
    link?: string;
    // 29 Oct 2026 (fourth pass): confirmed with the user — a rejection the
    // recipient needs to act on (revise and resubmit) should be flagged
    // apart from a routine, read-only notice. Defaults false; callers opt
    // in explicitly, never inferred from `type`.
    urgent?: boolean;
  },
  db: DbClient = prisma
): Promise<void> {
  const recipientIds = new Set<string>();

  if (entry.audience === "company" || entry.audience === "both") {
    for (const id of await resolveCompanyRecipientIds(entry.projectId, db)) recipientIds.add(id);
  }
  if (entry.audience === "finance" || entry.audience === "financeAndClient") {
    for (const id of await resolveFinanceRecipientIds(entry.projectId, db)) recipientIds.add(id);
  }
  if (entry.audience === "client" || entry.audience === "both" || entry.audience === "financeAndClient") {
    for (const id of await resolveClientRecipientIds(entry.projectId, db)) recipientIds.add(id);
  }

  if (recipientIds.size === 0) return;

  await db.notification.createMany({
    data: Array.from(recipientIds).map((recipientId) => ({
      recipientId,
      projectId: entry.projectId,
      type: entry.type,
      message: entry.message,
      link: entry.link,
      urgent: entry.urgent ?? false,
    })),
  });
}

// 29 Oct 2026 (fourth pass): direct, explicit recipients — for the new
// materials-approval workflow, which isn't scoped to a Project at all (a
// RawMaterial is a company-wide catalog entry, same reason
// notifyCompanyWide below exists). Used both to tell Admin/Project Lead a
// material is awaiting their review, and to tell the NPD Executive who
// submitted it what happened to it — a one- or two-person audience, not a
// role-wide broadcast.
export async function notifyUsers(
  userIds: string[],
  entry: { type: string; message: string; link?: string; urgent?: boolean },
  db: DbClient = prisma
): Promise<void> {
  const ids = Array.from(new Set(userIds));
  if (ids.length === 0) return;

  await db.notification.createMany({
    data: ids.map((recipientId) => ({
      recipientId,
      projectId: null,
      type: entry.type,
      message: entry.message,
      link: entry.link,
      urgent: entry.urgent ?? false,
    })),
  });
}

// 29 Oct 2026: stock-monitoring addition. RawMaterial is a company-wide
// catalog entry, not scoped to a Project, so the resolveCompanyRecipientIds
// helper above (which starts from a projectId) doesn't apply — this
// notifies every active ADMIN and NPD_EXECUTIVE directly instead, since
// those are the roles with inventory-manage access (lib/inventory/scope.ts).
// Notification.projectId is left null, same nullable field the model
// already had for exactly this kind of non-project notification.
export async function notifyCompanyWide(
  entry: { type: string; message: string; link?: string; urgent?: boolean },
  db: DbClient = prisma
): Promise<void> {
  const recipients = await db.user.findMany({
    where: { role: { in: ["ADMIN", "NPD_EXECUTIVE"] }, active: true },
    select: { id: true },
  });
  if (recipients.length === 0) return;

  await db.notification.createMany({
    data: recipients.map((u) => ({
      recipientId: u.id,
      projectId: null,
      type: entry.type,
      message: entry.message,
      link: entry.link,
      urgent: entry.urgent ?? false,
    })),
  });
}

// 29 Oct 2026 (fourth pass): same shape as notifyCompanyWide above, but for
// an arbitrary role list — used by the materials-approval workflow to
// reach Admin + Project Lead (the two roles that can approve/reject a
// material) without also reaching every NPD Executive, which
// notifyCompanyWide's hardcoded ADMIN/NPD_EXECUTIVE pair would do here.
export async function notifyRoleWide(
  roles: ("ADMIN" | "PROJECT_LEAD" | "NPD_EXECUTIVE" | "CLIENT")[],
  entry: { type: string; message: string; link?: string; urgent?: boolean },
  db: DbClient = prisma
): Promise<void> {
  const recipients = await db.user.findMany({
    where: { role: { in: roles }, active: true },
    select: { id: true },
  });
  if (recipients.length === 0) return;

  await db.notification.createMany({
    data: recipients.map((u: { id: string }) => ({
      recipientId: u.id,
      projectId: null,
      type: entry.type,
      message: entry.message,
      link: entry.link,
      urgent: entry.urgent ?? false,
    })),
  });
}
