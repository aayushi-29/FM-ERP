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

// Writes one Notification row per resolved recipient. `audience` picks who
// gets it: "company" (Admins + the assigned Project Lead/NPD Executives),
// "client" (active Client users in the project's org), or "both" — the
// default for a payment event, since the user asked for notifications on
// "client and company both". Pass `db` as a transaction client so these
// commit atomically with the event they describe, same convention as
// logAudit/logProjectActivity.
export async function notify(
  entry: {
    projectId: string;
    audience: "company" | "client" | "both";
    type: string;
    message: string;
    link?: string;
  },
  db: DbClient = prisma
): Promise<void> {
  const recipientIds = new Set<string>();

  if (entry.audience === "company" || entry.audience === "both") {
    for (const id of await resolveCompanyRecipientIds(entry.projectId, db)) recipientIds.add(id);
  }
  if (entry.audience === "client" || entry.audience === "both") {
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
    })),
  });
}
