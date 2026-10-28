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
    return { projectIds: [], overdueTasks: [], overdueMilestones: [], pendingApprovals: [], invoicesAwaitingAction: [] };
  }

  const [overdueTasks, overdueMilestones, pendingApprovals, invoicesAwaitingAction] = await Promise.all([
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
  ]);

  return { projectIds, overdueTasks, overdueMilestones, pendingApprovals, invoicesAwaitingAction };
}

export async function getNpdExecutiveDashboard(user: SessionUser) {
  const [myTasks, draftVersions, rejectedVersions, myTrials] = await Promise.all([
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
  ]);

  return { myTasks, draftVersions, rejectedVersions, myTrials };
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
