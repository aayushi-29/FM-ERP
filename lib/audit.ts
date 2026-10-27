import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type DbClient = typeof prisma | Prisma.TransactionClient;

// Baseline §10: "record who performed sensitive actions, what
// record/version was affected, and when" — and the audit log is append-only
// by convention (no update/delete route exists for it anywhere in the app).
//
// Pass `db` as a transaction client (prisma.$transaction's callback arg) so
// the audit row commits atomically with the write it describes (baseline
// §7: "use database transactions for operations that must succeed or fail
// together") — a user created without its audit row, or vice versa, is
// exactly the kind of drift the audit log exists to prevent. Omit `db` only
// for a record of something that already happened outside a transaction
// (e.g. a login).
export async function logAudit(
  entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    before?: unknown;
    after?: unknown;
  },
  db: DbClient = prisma
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      before: entry.before === undefined ? undefined : JSON.parse(JSON.stringify(entry.before)),
      after: entry.after === undefined ? undefined : JSON.parse(JSON.stringify(entry.after)),
    },
  });
}
