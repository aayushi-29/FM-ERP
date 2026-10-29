import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { CLIENT_SAFE_PROJECT_SELECT } from "@/lib/projects/scope";
import { TaskList } from "./task-list";
import { NewTaskForm } from "./new-task-form";
import { MilestoneList } from "./milestone-list";
import { NewMilestoneForm } from "./new-milestone-form";
import { AssignForm } from "./assign-form";
import { HandoverControl } from "./handover-control";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  await assertProjectAccessOrRedirect(user, params.id);

  if (user.role === "CLIENT") {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      select: {
        ...CLIENT_SAFE_PROJECT_SELECT,
        milestones: true,
        // 29 Oct 2026 (second pass), item #4: read-only task tracking —
        // title/status/assignee/dates only, no edit affordance anywhere in
        // this branch. assignedAt/completedAt shown alongside the status
        // so the client sees a "delivery style" trail, not raw timestamps
        // from createdAt/updatedAt that could be edits unrelated to status.
        tasks: {
          select: { id: true, title: true, status: true, dueDate: true, assignedAt: true, completedAt: true, assignee: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!project) notFound();

    // Item #3: MRP visibility — reads ONLY the single published number,
    // never the CostSheet itself (canReadCosting still denies Client any
    // direct access to that model/route).
    const publishedMrp = await prisma.costSheet.findFirst({
      where: { projectId: project.id, mrpPublishedAt: { not: null } },
      orderBy: { mrpPublishedAt: "desc" },
      select: { recommendedMrp: true, currency: true, mrpPublishedAt: true },
    });

    const taskStatusLabel: Record<string, string> = {
      TODO: "To do",
      IN_PROGRESS: "In progress",
      BLOCKED: "Blocked",
      DONE: "Delivered",
    };
    const taskStatusBadgeClass: Record<string, string> = {
      TODO: "fm-badge",
      IN_PROGRESS: "fm-badge fm-badge-gold",
      BLOCKED: "fm-badge fm-badge-warn",
      DONE: "fm-badge fm-badge-good",
    };

    return (
      <main>
        <div className="fm-page-head">
          <h1>{project.name}</h1>
          <p className="fm-muted">
            {project.status}
            {project.targetDate ? ` · target ${new Date(project.targetDate).toLocaleDateString()}` : ""}
            {project.lead ? ` · led by ${project.lead.name}` : ""}
          </p>
        </div>

        {!project.advancePaymentVerifiedAt ? (
          <div className="fm-advance-banner" role="status">
            Work on this project starts once your 60% advance payment is verified.
            You&apos;ll see a notification here as soon as that happens.
          </div>
        ) : null}

        {publishedMrp?.recommendedMrp ? (
          <div className="fm-stat-row">
            <div className="glass glass-sm fm-stat">
              <div className="fm-stat-value">
                {publishedMrp.recommendedMrp.toString()} {publishedMrp.currency}
              </div>
              <div className="fm-stat-label">MRP</div>
            </div>
          </div>
        ) : null}

        <div className="fm-section-grid" style={{ marginTop: 20 }}>
          <div className="glass glass-sm glass-card fm-section">
            <h3>Milestones</h3>
            <MilestoneList
              milestones={project.milestones.map((m) => ({
                id: m.id,
                title: m.title,
                status: m.status,
                dueDate: m.dueDate ? m.dueDate.toISOString() : null,
              }))}
              role="CLIENT"
            />
          </div>

          <div className="glass glass-sm glass-card fm-section">
            <h3>Tasks</h3>
            {project.tasks.length === 0 ? (
              <p className="fm-empty">Nothing here right now.</p>
            ) : (
              <ul>
                {project.tasks.map((t: (typeof project.tasks)[number]) => (
                  <li key={t.id}>
                    {t.title}
                    {" "}
                    <span className={taskStatusBadgeClass[t.status]}>{taskStatusLabel[t.status] ?? t.status}</span>
                    <span className="fm-li-meta">
                      {t.assignee ? `${t.assignee.name} · ` : ""}
                      {t.dueDate ? `due ${new Date(t.dueDate).toLocaleDateString()}` : "no due date"}
                      {t.assignedAt ? ` · assigned ${new Date(t.assignedAt).toLocaleDateString()}` : ""}
                      {t.completedAt ? ` · completed ${new Date(t.completedAt).toLocaleDateString()}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="glass glass-sm glass-card fm-section">
            <h3>Documents</h3>
            <Link href={`/projects/${project.id}/documents`}>Open documents →</Link>
          </div>

          <div className="glass glass-sm glass-card fm-section">
            <h3>Invoices</h3>
            <Link href={`/projects/${project.id}/costing`}>Open invoices →</Link>
          </div>
        </div>
      </main>
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      clientOrg: { select: { name: true } },
      lead: { select: { name: true } },
      tasks: {
        select: { id: true, title: true, status: true, dueDate: true, assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      milestones: { orderBy: { createdAt: "asc" } },
      assignments: { include: { user: { select: { id: true, name: true, role: true } } } },
    },
  });
  if (!project) notFound();

  const canManage = user.role === "ADMIN" || user.role === "PROJECT_LEAD";
  const assignedUserIds = new Set(project.assignments.map((a) => a.userId));

  const candidates = canManage
    ? await prisma.user.findMany({
        where: {
          active: true,
          role: { in: ["PROJECT_LEAD", "NPD_EXECUTIVE"] },
          id: { notIn: Array.from(assignedUserIds) },
        },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 800 }}>
      <h1>{project.name}</h1>
      <p style={{ color: "#555" }}>
        {project.clientOrg.name} · {project.status}
        {project.targetDate ? ` · target ${new Date(project.targetDate).toLocaleDateString()}` : ""}
        {" · led by "}{project.lead.name}
      </p>

      {!project.advancePaymentVerifiedAt ? (
        <div className="fm-advance-banner" role="status">
          Locked: the 60% advance payment hasn&apos;t been verified yet, so tasks and trials
          can&apos;t be created on this project.
          {user.role === "ADMIN" ? (
            <>
              {" "}
              <Link href={`/projects/${project.id}/costing`}>Go verify the advance invoice →</Link>
            </>
          ) : null}
        </div>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Team</h2>
      <ul>
        {project.assignments.map((a) => (
          <li key={a.id}>{a.user.name} — {a.user.role}</li>
        ))}
      </ul>
      {canManage ? <AssignForm projectId={project.id} candidates={candidates} /> : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Tasks</h2>
      <TaskList
        tasks={project.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          assignee: t.assignee,
          dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        }))}
      />
      {canManage && project.advancePaymentVerifiedAt ? (
        <div style={{ marginTop: 10 }}>
          <NewTaskForm
            projectId={project.id}
            assignees={project.assignments.map((a) => a.user)}
            maxDueDate={project.targetDate ? project.targetDate.toISOString().slice(0, 10) : undefined}
          />
        </div>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Milestones</h2>
      <MilestoneList
        milestones={project.milestones.map((m) => ({
          id: m.id,
          title: m.title,
          status: m.status,
          dueDate: m.dueDate ? m.dueDate.toISOString() : null,
        }))}
        role={user.role}
      />
      {canManage ? (
        <div style={{ marginTop: 10 }}>
          <NewMilestoneForm
            projectId={project.id}
            maxDueDate={project.targetDate ? project.targetDate.toISOString().slice(0, 10) : undefined}
          />
        </div>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Products &amp; formulations</h2>
      <p style={{ color: "#555", fontSize: ".9rem" }}>
        Track recipes, process notes, trials, and client approvals for this project.
      </p>
      <Link href={`/projects/${project.id}/products`}>Open products →</Link>

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Documents</h2>
      <p style={{ color: "#555", fontSize: ".9rem" }}>
        Contracts, technical specs, trial records, and anything shared with the client.
      </p>
      <Link href={`/projects/${project.id}/documents`}>Open documents →</Link>

      {user.role !== "NPD_EXECUTIVE" ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Costing &amp; Invoicing</h2>
          <p style={{ color: "#555", fontSize: ".9rem" }}>
            Cost sheets, expenses, and invoices for this project.
          </p>
          <Link href={`/projects/${project.id}/costing`}>Open costing &amp; invoicing →</Link>
        </>
      ) : null}

      {user.role === "ADMIN" && project.status !== "COMPLETED" ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Final handover</h2>
          <p style={{ color: "#555", fontSize: ".9rem" }}>
            Marks the project complete. Blocked until the 15% final payment is verified.
          </p>
          <HandoverControl projectId={project.id} />
        </>
      ) : null}
      {project.status === "COMPLETED" ? (
        <p style={{ color: "#2a7a2a", fontSize: ".9rem", marginTop: 16 }}>
          ✓ Final product handed over — this project is complete.
        </p>
      ) : null}
    </main>
  );
}
