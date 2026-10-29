import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/session";

// Each function here is read-only and already scoped to the user it's
// called for — a dashboard is a summary view, not a new access path, so
// every query below applies the same project-assignment / client-org
// boundaries the rest of the app enforces in lib/auth/rbac.ts. Nothing
// here substitutes for assertProjectAccess on a detail page; these are
// just pre-filtered lists for the landing view.

const OVERDUE_TASK_SELECT = {
  id: true,
  title: true,
  dueDate: true,
  project: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const;

export async function getAdminDashboard() {
  const now = new Date();

  const [
    activeProjects,
    overdueTasks,
    overdueMilestones,
    pendingApprovals,
    overdueInvoices,
    unverifiedPayments,
  ] = await Promise.all([
    prisma.project.count({ where: { status: "ACTIVE" } }),
    prisma.task.findMany({
      where: { dueDate: { lt: now }, status: { not: "DONE" } },
      select: OVERDUE_TASK_SELECT,
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.milestone.findMany({
      where: { dueDate: { lt: now }, status: { in: ["PENDING", "SUBMITTED"] } },
      select: { id: true, title: true, dueDate: true, project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.formulationVersion.findMany({
      where: { status: "IN_REVIEW" },
      select: {
        id: true,
        versionNumber: true,
        submittedAt: true,
        formulation: { select: { name: true, product: { select: { name: true, project: { select: { id: true, name: true } } } } } },
      },
      orderBy: { submittedAt: "asc" },
      take: 8,
    }),
    prisma.invoice.findMany({
      where: { dueDate: { lt: now }, status: { in: ["SENT", "PARTIALLY_PAID"] } },
      select: { id: true, invoiceNumber: true, amount: true, dueDate: true, project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.payment.count({ where: { verifiedById: null } }),
  ]);

  return { activeProjects, overdueTasks, overdueMilestones, pendingApprovals, overdueInvoices, unverifiedPayments };
}

export async function getProjectLeadDashboard(user: SessionUser) {
  const now = new Date();

  const assignedProjectIds = (
    await prisma.projectAssignment.findMany({ where: { userId: user.id }, select: { projectId: true } })
  ).map((a) => a.projectId);
  const ledProjectIds = (
    await prisma.project.findMany({ where: { leadId: user.id }, select: { id: true } })
  ).map((p) => p.id);
  const projectIds = Array.from(new Set([...assignedProjectIds, ...ledProjectIds]));

  if (projectIds.length === 0) {
    return {
      projectIds: [],
      overdueTasks: [],
      overdueMilestones: [],
      pendingApprovals: [],
      invoicesAwaitingAction: [],
      activeProjects: [],
      inFlightFormulations: [],
    };
  }

  // 29 Oct 2026 (second pass), item #6: a Project Lead with no overdue work
  // previously saw an empty dashboard even with plenty of active work.
  // "Active" projects (not COMPLETED/CANCELLED) with a quick status, and
  // draft/in-review formulation versions across their assigned projects —
  // any author, not just their own — fill that gap. Both are read-only
  // summaries, same boundary as every other query here (see the file-level
  // comment): a Project Lead could already see all of this by opening each
  // project individually.
  const [overdueTasks, overdueMilestones, pendingApprovals, invoicesAwaitingAction, activeProjectsRaw, inFlightFormulations] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { not: "DONE" } },
      select: OVERDUE_TASK_SELECT,
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.milestone.findMany({
      where: { projectId: { in: projectIds }, dueDate: { lt: now }, status: { in: ["PENDING", "SUBMITTED"] } },
      select: { id: true, title: true, dueDate: true, project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.formulationVersion.findMany({
      where: { status: "IN_REVIEW", formulation: { product: { projectId: { in: projectIds } } } },
      select: {
        id: true,
        versionNumber: true,
        submittedAt: true,
        formulation: { select: { name: true, product: { select: { name: true, project: { select: { id: true, name: true } } } } } },
      },
      orderBy: { submittedAt: "asc" },
      take: 10,
    }),
    prisma.invoice.findMany({
      where: { projectId: { in: projectIds }, status: { in: ["SENT", "PARTIALLY_PAID"] } },
      select: { id: true, invoiceNumber: true, amount: true, dueDate: true, status: true, project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.project.findMany({
      where: { id: { in: projectIds }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { tasks: true } },
        milestones: { where: { status: { in: ["PENDING", "SUBMITTED"] } }, select: { id: true } },
      },
      orderBy: { name: "asc" },
      take: 10,
    }),
    prisma.formulationVersion.findMany({
      where: { status: { in: ["DRAFT", "IN_REVIEW"] }, formulation: { product: { projectId: { in: projectIds } } } },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        author: { select: { name: true } },
        formulation: { select: { name: true, product: { select: { name: true, project: { select: { id: true, name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const activeProjects = activeProjectsRaw.map((p: (typeof activeProjectsRaw)[number]) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    taskCount: p._count.tasks,
    openMilestoneCount: p.milestones.length,
  }));

  return { projectIds, overdueTasks, overdueMilestones, pendingApprovals, invoicesAwaitingAction, activeProjects, inFlightFormulations };
}

export async function getNpdExecutiveDashboard(user: SessionUser) {
  const { canManageInventory } = await import("@/lib/inventory/scope");

  const [myTasks, draftVersions, rejectedVersions, myTrials, lowStockMaterials] = await Promise.all([
    // 29 Oct 2026 (second pass), item #6: all active assigned tasks
    // regardless of due date — not just overdue ones, which previously
    // meant an NPD Executive on schedule saw nothing here at all.
    prisma.task.findMany({
      where: { assigneeId: user.id, status: { not: "DONE" } },
      select: OVERDUE_TASK_SELECT,
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.formulationVersion.findMany({
      where: { authorId: user.id, status: "DRAFT" },
      select: {
        id: true,
        versionNumber: true,
        createdAt: true,
        formulation: { select: { name: true, product: { select: { name: true, project: { select: { id: true, name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.formulationVersion.findMany({
      where: { authorId: user.id, status: "REJECTED", nextVersions: { none: {} } },
      select: {
        id: true,
        versionNumber: true,
        decidedAt: true,
        formulation: { select: { name: true, product: { select: { name: true, project: { select: { id: true, name: true } } } } } },
      },
      orderBy: { decidedAt: "desc" },
      take: 10,
    }),
    prisma.trial.findMany({
      where: { conductedById: user.id, status: { in: ["PLANNED", "IN_PROGRESS"] } },
      select: {
        id: true,
        status: true,
        conductedAt: true,
        formulationVersion: {
          select: { versionNumber: true, formulation: { select: { name: true, product: { select: { name: true, project: { select: { id: true, name: true } } } } } } },
        },
      },
      orderBy: { conductedAt: "desc" },
      take: 10,
    }),
    // 29 Oct 2026 (second pass), item #6: raw materials/suppliers they
    // manage with any low-stock flags from item #1. canManageInventory
    // already includes NPD_EXECUTIVE (lib/inventory/scope.ts) — this is
    // the same "no new access, just a surfaced summary" rule as the rest
    // of this file.
    canManageInventory(user.role)
      ? prisma.rawMaterial.findMany({
          where: { reorderThreshold: { not: null } },
          select: { id: true, name: true, defaultUnit: true, stockOnHand: true, reorderThreshold: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const lowStock = lowStockMaterials.filter(
    (m: (typeof lowStockMaterials)[number]) => m.reorderThreshold != null && Number(m.stockOnHand) <= Number(m.reorderThreshold)
  );

  return { myTasks, draftVersions, rejectedVersions, myTrials, lowStock };
}

export async function getClientDashboard(user: SessionUser) {
  if (!user.clientOrgId) {
    return { projects: [], recentDocuments: [], openInvoices: [] };
  }

  const [projects, recentDocuments, openInvoices] = await Promise.all([
    prisma.project.findMany({
      where: { clientOrgId: user.clientOrgId },
      select: {
        id: true,
        name: true,
        status: true,
        targetDate: true,
        milestones: { select: { id: true, title: true, dueDate: true, status: true }, orderBy: { dueDate: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.document.findMany({
      where: { project: { clientOrgId: user.clientOrgId }, visibility: "CLIENT_VISIBLE" },
      select: { id: true, type: true, createdAt: true, project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.invoice.findMany({
      where: { project: { clientOrgId: user.clientOrgId }, status: { in: ["SENT", "PARTIALLY_PAID"] } },
      select: { id: true, invoiceNumber: true, amount: true, dueDate: true, status: true, project: { select: { id: true, name: true } } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
  ]);

  return { projects, recentDocuments, openInvoices };
}
