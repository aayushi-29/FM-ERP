import { prisma } from "@/lib/prisma";

// Surfaced by the user-delete endpoint (app/api/users/[id]/route.ts) when a
// hard delete is blocked by a foreign-key violation. Rather than a bare
// "can't delete this user" message, this tells the admin exactly which
// projects/invoices/etc. are still pointing at them, with a link to go
// look at (and where possible, reassign or resolve) each one — so they
// have a concrete next step instead of a dead end.
//
// Deliberately NOT exhaustive of every User relation in schema.prisma:
// Task.assigneeId and Notification.recipientId are cleared automatically
// by the delete route itself (see the comment there) rather than listed
// here, and AuditLog.actorId is reported as a plain count with no items —
// it's the system's own history of what this account did, not something
// an admin "goes and fixes" by reassigning it to someone else.
export type DeleteBlockerItem = { label: string; href?: string };
export type DeleteBlockerGroup = { label: string; count: number; items: DeleteBlockerItem[] };

const SAMPLE_SIZE = 5;

export async function getUserDeleteBlockers(userId: string): Promise<DeleteBlockerGroup[]> {
  const [
    projectsLed,
    projectsLedCount,
    invoicesCreated,
    invoicesCreatedCount,
    costSheetsCreated,
    costSheetsCreatedCount,
    formulationVersionsAuthored,
    formulationVersionsAuthoredCount,
    approvalsGiven,
    approvalsGivenCount,
    proposals,
    proposalsCount,
    rawMaterials,
    rawMaterialsCount,
    documentsUploaded,
    documentsUploadedCount,
    payments,
    paymentsCount,
    paymentClaims,
    paymentClaimsCount,
    creditNotesIssued,
    creditNotesIssuedCount,
    expensesCreated,
    expensesCreatedCount,
    stockMovementCount,
    revisionRequestCount,
    auditLogCount,
  ] = await Promise.all([
    prisma.project.findMany({ where: { leadId: userId }, select: { id: true, name: true }, take: SAMPLE_SIZE }),
    prisma.project.count({ where: { leadId: userId } }),
    prisma.invoice.findMany({
      where: { createdById: userId },
      select: { id: true, invoiceNumber: true },
      take: SAMPLE_SIZE,
    }),
    prisma.invoice.count({ where: { createdById: userId } }),
    prisma.costSheet.findMany({ where: { createdById: userId }, select: { id: true }, take: SAMPLE_SIZE }),
    prisma.costSheet.count({ where: { createdById: userId } }),
    prisma.formulationVersion.findMany({
      where: { authorId: userId },
      select: { id: true, versionNumber: true },
      take: SAMPLE_SIZE,
    }),
    prisma.formulationVersion.count({ where: { authorId: userId } }),
    prisma.approval.findMany({
      where: { approverId: userId },
      select: { id: true, formulationVersionId: true },
      take: SAMPLE_SIZE,
    }),
    prisma.approval.count({ where: { approverId: userId } }),
    prisma.proposal.findMany({
      where: { OR: [{ preparedById: userId }, { reviewedById: userId }] },
      select: { id: true, title: true, leadId: true },
      take: SAMPLE_SIZE,
    }),
    prisma.proposal.count({ where: { OR: [{ preparedById: userId }, { reviewedById: userId }] } }),
    prisma.rawMaterial.findMany({
      where: { OR: [{ createdById: userId }, { approvedById: userId }] },
      select: { id: true, name: true },
      take: SAMPLE_SIZE,
    }),
    prisma.rawMaterial.count({ where: { OR: [{ createdById: userId }, { approvedById: userId }] } }),
    prisma.document.findMany({
      where: { uploadedById: userId },
      select: { id: true, projectId: true },
      take: SAMPLE_SIZE,
    }),
    prisma.document.count({ where: { uploadedById: userId } }),
    prisma.payment.findMany({
      where: { OR: [{ recordedById: userId }, { verifiedById: userId }] },
      select: { id: true, invoiceId: true },
      take: SAMPLE_SIZE,
    }),
    prisma.payment.count({ where: { OR: [{ recordedById: userId }, { verifiedById: userId }] } }),
    prisma.paymentClaim.findMany({
      where: { OR: [{ submittedById: userId }, { respondedById: userId }] },
      select: { id: true, invoiceId: true },
      take: SAMPLE_SIZE,
    }),
    prisma.paymentClaim.count({ where: { OR: [{ submittedById: userId }, { respondedById: userId }] } }),
    prisma.creditNote.findMany({
      where: { issuedById: userId },
      select: { id: true, invoiceId: true },
      take: SAMPLE_SIZE,
    }),
    prisma.creditNote.count({ where: { issuedById: userId } }),
    prisma.projectExpense.findMany({
      where: { createdById: userId },
      select: { id: true, projectId: true },
      take: SAMPLE_SIZE,
    }),
    prisma.projectExpense.count({ where: { createdById: userId } }),
    prisma.stockMovement.count({ where: { recordedById: userId } }),
    prisma.revisionRequest.count({ where: { requestedById: userId } }),
    prisma.auditLog.count({ where: { actorId: userId } }),
  ]);

  const groups: DeleteBlockerGroup[] = [];

  function addGroup<T>(label: string, rows: T[], count: number, toItem: (row: T) => DeleteBlockerItem) {
    if (count === 0) return;
    const items = rows.map(toItem);
    if (count > items.length) {
      items.push({ label: `+${count - items.length} more` });
    }
    groups.push({ label, count, items });
  }

  addGroup("Projects led", projectsLed, projectsLedCount, (p) => ({ label: p.name, href: `/projects/${p.id}` }));
  addGroup("Invoices created", invoicesCreated, invoicesCreatedCount, (i) => ({
    label: i.invoiceNumber,
    href: `/invoices/${i.id}`,
  }));
  addGroup("Cost sheets created", costSheetsCreated, costSheetsCreatedCount, (c) => ({
    label: `Cost sheet ${c.id.slice(-6)}`,
    href: `/cost-sheets/${c.id}`,
  }));
  addGroup(
    "Formulation versions authored",
    formulationVersionsAuthored,
    formulationVersionsAuthoredCount,
    (f) => ({ label: `Version ${f.versionNumber}`, href: `/formulation-versions/${f.id}` })
  );
  addGroup("Approvals given", approvalsGiven, approvalsGivenCount, (a) => ({
    label: "Approval",
    href: a.formulationVersionId ? `/formulation-versions/${a.formulationVersionId}` : undefined,
  }));
  addGroup("Proposals prepared or reviewed", proposals, proposalsCount, (p) => ({
    label: p.title,
    href: `/leads/${p.leadId}`,
  }));
  addGroup("Raw materials created or approved", rawMaterials, rawMaterialsCount, (m) => ({
    label: m.name,
    href: "/raw-materials",
  }));
  addGroup("Documents uploaded", documentsUploaded, documentsUploadedCount, (d) => ({
    label: `Document ${d.id.slice(-6)}`,
    href: `/projects/${d.projectId}`,
  }));
  addGroup("Payments recorded or verified", payments, paymentsCount, (p) => ({
    label: `Payment ${p.id.slice(-6)}`,
    href: `/invoices/${p.invoiceId}`,
  }));
  addGroup("Payment claims submitted or responded to", paymentClaims, paymentClaimsCount, (c) => ({
    label: `Claim ${c.id.slice(-6)}`,
    href: `/invoices/${c.invoiceId}`,
  }));
  addGroup("Credit notes issued", creditNotesIssued, creditNotesIssuedCount, (c) => ({
    label: `Credit note ${c.id.slice(-6)}`,
    href: `/invoices/${c.invoiceId}`,
  }));
  addGroup("Project expenses recorded", expensesCreated, expensesCreatedCount, (e) => ({
    label: `Expense ${e.id.slice(-6)}`,
    href: `/projects/${e.projectId}`,
  }));

  if (stockMovementCount > 0) {
    groups.push({
      label: "Stock movements recorded",
      count: stockMovementCount,
      items: [{ label: `${stockMovementCount} movement(s)`, href: "/raw-materials" }],
    });
  }
  if (revisionRequestCount > 0) {
    groups.push({
      label: "Revision requests filed",
      count: revisionRequestCount,
      items: [{ label: `${revisionRequestCount} request(s)` }],
    });
  }
  if (auditLogCount > 0) {
    groups.push({
      label: "Audit log history",
      count: auditLogCount,
      items: [{ label: `${auditLogCount} logged action(s) — kept as system history, not reassignable` }],
    });
  }

  return groups;
}
