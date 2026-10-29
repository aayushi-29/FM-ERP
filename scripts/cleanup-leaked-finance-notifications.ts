// 29 Oct 2026 (fourth pass): one-off data cleanup, not a schema migration.
//
// The confidentiality fix in commit f2a3ae1 stopped NEW payment_claim.* /
// invoice.* notifications from reaching Project Lead — but it's a routing
// fix, not a delete. Notification rows that were already written to the
// database *before* that fix (while "finance" still resolved to Admin +
// Project Lead) are untouched by it and keep showing up on a Project
// Lead's /notifications page, same as the screenshot the user sent
// ("A payment claim of 212000.00 INR was submitted...", "Invoice
// FM-2026-0001 raised... (212000 INR)" — both visible to a PROJECT_LEAD
// account).
//
// This deletes exactly those stale rows: any Notification whose recipient
// is a PROJECT_LEAD and whose `type` is one of the financial event types
// that should only ever have gone to Admin/Client. It does NOT touch
// notifications for any other role, and does not touch non-financial
// types (raw_material.*, formulation_version.*, payment.verified,
// project.handed_over, etc.) even for a Project Lead recipient — those
// were always meant for them and still are.
//
// Run once, locally, after pulling f2a3ae1 or later:
//   npx tsx scripts/cleanup-leaked-finance-notifications.ts
//
// Safe to re-run — it's just a DELETE ... WHERE, idempotent once the rows
// are gone.

// Relative import + own PrismaClient, matching prisma/seed.ts's pattern —
// tsx doesn't resolve the "@/*" tsconfig path alias used by the Next.js
// app code, so lib/prisma's singleton isn't reachable from a standalone
// script the way it is from route handlers.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LEAKED_FINANCE_TYPES = [
  "payment_claim.submitted",
  "payment_claim.acknowledged",
  "payment_claim.rejected",
  "invoice.staged",
] as const;

async function main() {
  const result = await prisma.notification.deleteMany({
    where: {
      type: { in: [...LEAKED_FINANCE_TYPES] },
      recipient: { role: "PROJECT_LEAD" },
    },
  });

  console.log(
    `Deleted ${result.count} stale finance notification(s) that had reached Project Lead recipients before the confidentiality fix.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
