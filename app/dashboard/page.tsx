import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import {
  getAdminDashboard,
  getProjectLeadDashboard,
  getNpdExecutiveDashboard,
  getClientDashboard,
} from "@/lib/dashboard/queries";
import { Shell } from "@/app/components/shell";
import { StatValue } from "@/app/components/stat-value";

// Role-specific landing view (baseline §11). Each branch below is a plain
// read-only summary built from the already-scoped queries in
// lib/dashboard/queries.ts — it is not its own access path, so every
// list here is something the role could already see by navigating to the
// underlying page; this just surfaces what needs attention first.

function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

function timeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Working late";
}

const ROLE_WELCOME: Record<SessionUser["role"], string> = {
  ADMIN: "Here's what needs attention across every project today.",
  PROJECT_LEAD: "Here's what's moving — and what's overdue — on your projects.",
  NPD_EXECUTIVE: "Your open work: tasks, drafts, and trials in flight.",
  CLIENT: "Here's where things stand on your projects.",
};

export default async function DashboardPage() {
  const user = await requireUserOrRedirect();

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>
          {timeOfDayGreeting()}, {user.name.split(" ")[0]}
        </h1>
        <p className="fm-muted">{ROLE_WELCOME[user.role]}</p>
      </div>

      {user.role === "ADMIN" ? <AdminSection /> : null}
      {user.role === "PROJECT_LEAD" ? <ProjectLeadSection user={user} /> : null}
      {user.role === "NPD_EXECUTIVE" ? <NpdExecutiveSection user={user} /> : null}
      {user.role === "CLIENT" ? <ClientSection user={user} /> : null}
    </Shell>
  );
}

async function AdminSection() {
  const d = await getAdminDashboard();

  return (
    <>
      <div className="fm-stat-row">
        <Stat label="Active projects" value={d.activeProjects} />
        <Stat label="Overdue tasks" value={d.overdueTasks.length} warn={d.overdueTasks.length > 0} />
        <Stat label="Overdue milestones" value={d.overdueMilestones.length} warn={d.overdueMilestones.length > 0} />
        <Stat label="Pending approvals" value={d.pendingApprovals.length} warn={d.pendingApprovals.length > 0} />
        <Stat label="Overdue invoices" value={d.overdueInvoices.length} warn={d.overdueInvoices.length > 0} />
        <Stat label="Unverified payments" value={d.unverifiedPayments} warn={d.unverifiedPayments > 0} />
      </div>

      <div className="fm-section-grid">
        <Section title="Overdue tasks">
          {d.overdueTasks.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.overdueTasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> — {t.title}
                  {t.assignee ? ` (${t.assignee.name})` : ""}
                  <span className="fm-li-meta">due {fmtDate(t.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Overdue milestones">
          {d.overdueMilestones.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.overdueMilestones.map((m) => (
                <li key={m.id}>
                  <Link href={`/projects/${m.project.id}`}>{m.project.name}</Link> — {m.title}
                  <span className="fm-li-meta">due {fmtDate(m.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Pending formulation approvals">
          {d.pendingApprovals.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.pendingApprovals.map((v) => (
                <li key={v.id}>
                  <Link href={`/formulation-versions/${v.id}`}>
                    {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v
                    {v.versionNumber}
                  </Link>
                  <span className="fm-li-meta">submitted {fmtDate(v.submittedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Overdue invoices">
          {d.overdueInvoices.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.overdueInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`}>
                    {inv.project.name} — {inv.invoiceNumber}
                  </Link>
                  <span className="fm-li-meta">
                    {inv.amount.toString()} · due {fmtDate(inv.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

async function ProjectLeadSection({ user }: { user: SessionUser }) {
  const d = await getProjectLeadDashboard(user);

  if (d.projectIds.length === 0) {
    return (
      <div className="glass glass-sm glass-card">
        <p className="fm-muted" style={{ margin: 0 }}>
          No projects assigned yet — <Link href="/projects">browse projects</Link>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="fm-stat-row">
        <Stat label="Your projects" value={d.projectIds.length} />
        <Stat label="Overdue tasks" value={d.overdueTasks.length} warn={d.overdueTasks.length > 0} />
        <Stat label="Overdue milestones" value={d.overdueMilestones.length} warn={d.overdueMilestones.length > 0} />
        <Stat label="Pending your approval" value={d.pendingApprovals.length} warn={d.pendingApprovals.length > 0} />
      </div>

      <div className="fm-section-grid">
        <Section title="Overdue tasks">
          {d.overdueTasks.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.overdueTasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> — {t.title}
                  {t.assignee ? ` (${t.assignee.name})` : ""}
                  <span className="fm-li-meta">due {fmtDate(t.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Overdue milestones">
          {d.overdueMilestones.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.overdueMilestones.map((m) => (
                <li key={m.id}>
                  <Link href={`/projects/${m.project.id}`}>{m.project.name}</Link> — {m.title}
                  <span className="fm-li-meta">due {fmtDate(m.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Formulations pending your approval">
          {d.pendingApprovals.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.pendingApprovals.map((v) => (
                <li key={v.id}>
                  <Link href={`/formulation-versions/${v.id}`}>
                    {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v
                    {v.versionNumber}
                  </Link>
                  <span className="fm-li-meta">submitted {fmtDate(v.submittedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Invoices awaiting payment">
          {d.invoicesAwaitingAction.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.invoicesAwaitingAction.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/invoices/${inv.id}`}>
                    {inv.project.name} — {inv.invoiceNumber}
                  </Link>
                  <span className="fm-li-meta">
                    {inv.amount.toString()} · {inv.status} · due {fmtDate(inv.dueDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

async function NpdExecutiveSection({ user }: { user: SessionUser }) {
  const d = await getNpdExecutiveDashboard(user);

  return (
    <>
      <div className="fm-stat-row">
        <Stat label="Your open tasks" value={d.myTasks.length} warn={d.myTasks.length > 0} />
        <Stat label="Drafts to submit" value={d.draftVersions.length} />
        <Stat label="Rejected — needs revision" value={d.rejectedVersions.length} warn={d.rejectedVersions.length > 0} />
        <Stat label="Open trials" value={d.myTrials.length} />
      </div>

      <div className="fm-section-grid">
        <Section title="Your open tasks">
          {d.myTasks.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.myTasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> — {t.title}
                  <span className="fm-li-meta">due {fmtDate(t.dueDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Draft formulations (not yet submitted)">
          {d.draftVersions.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.draftVersions.map((v) => (
                <li key={v.id}>
                  <Link href={`/formulation-versions/${v.id}`}>
                    {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v
                    {v.versionNumber}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Rejected — needs revision">
          {d.rejectedVersions.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.rejectedVersions.map((v) => (
                <li key={v.id}>
                  <Link href={`/formulation-versions/${v.id}`}>
                    {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v
                    {v.versionNumber}
                  </Link>
                  <span className="fm-li-meta">rejected {fmtDate(v.decidedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Open trials">
          {d.myTrials.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.myTrials.map((t) => (
                <li key={t.id}>
                  {t.formulationVersion.formulation.product.project.name} —{" "}
                  {t.formulationVersion.formulation.product.name} / {t.formulationVersion.formulation.name} v
                  {t.formulationVersion.versionNumber}
                  <span className="fm-li-meta">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

async function ClientSection({ user }: { user: SessionUser }) {
  const d = await getClientDashboard(user);

  return (
    <div className="fm-section-grid">
      <Section title="Your projects">
        {d.projects.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {d.projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>{p.name}</Link>
                <span className="fm-li-meta">
                  {p.status}
                  {p.targetDate ? ` · target ${fmtDate(p.targetDate)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent documents shared with you">
        {d.recentDocuments.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {d.recentDocuments.map((doc) => (
              <li key={doc.id}>
                <Link href={`/projects/${doc.project.id}/documents`}>{doc.project.name}</Link> — {doc.type}
                <span className="fm-li-meta">{fmtDate(doc.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Open invoices">
        {d.openInvoices.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {d.openInvoices.map((inv) => (
              <li key={inv.id}>
                <Link href={`/invoices/${inv.id}`}>
                  {inv.project.name} — {inv.invoiceNumber}
                </Link>
                <span className="fm-li-meta">
                  {inv.amount.toString()} · {inv.status} · due {fmtDate(inv.dueDate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className={`glass glass-sm fm-stat${warn ? " fm-stat-warn" : ""}`}>
      <div className="fm-stat-value">
        <StatValue value={value} />
      </div>
      <div className="fm-stat-label">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass glass-sm glass-card fm-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="fm-empty">Nothing here right now.</p>;
}
