import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type DbClient = typeof prisma | Prisma.TransactionClient;

// Routine, high-volume project events (task created, status changed) go
// here, not AuditLog — AuditLog (lib/audit.ts) is for sensitive/compliance
// actions (approvals, account changes, record creation), and would get
// noisy if every task drag-and-drop wrote a row there too. Approvals
// (milestone decisions) and project creation/edits still go to BOTH: a
// ProjectActivity line for the feed, and an AuditLog row because baseline
// §10 explicitly calls out approvals as needing an audit trail.
export async function logProjectActivity(
  entry: { projectId: string; actorId: string; summary: string },
  db: DbClient = prisma
): Promise<void> {
  await db.projectActivity.create({ data: entry });
}
