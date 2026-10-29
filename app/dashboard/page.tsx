import Link from "next/link";
import type { Metadata } from "next";
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

export const metadata: Metadata = { title: "Dashboard" };

// Defensive guard, not a fix for a confirmed bug: requireUserOrRedirect()
// already calls cookies() (via getCurrentUser), which on its own forces
// Next.js to render this route dynamically per-request rather than caching
// a static shell — so stale counts are not a caching bug. This just makes
// that explicit so it's never in question again.
export const dynamic = "force-dynamic";

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
        <Stat label="Active projects" value={d.activeProjects} href="/projects" />
        <Stat
          label="Overdue tasks"
          value={d.overdueTasks.length}
          warn={d.overdueTasks.length > 0}
          href="#overdue-tasks"
        />
        <Stat
          label="Overdue milestones"
          value={d.overdueMilestones.length}
          warn={d.overdueMilestones.length > 0}
          href="#overdue-milestones"
        />
        <Stat
          label="Pending approvals"
          value={d.pendingApprovals.length}
          warn={d.pendingApprovals.length > 0}
          href="#pending-approvals"
        />
        <Stat
          label="Overdue invoices"
          value={d.overdueInvoices.length}
          warn={d.overdueInvoices.length > 0}
          href="#overdue-invoices"
        />
        <Stat label="Unverified payments" value={d.unverifiedPayments} warn={d.unverifiedPayments > 0} />
      </div>

      <div className="fm-section-grid">
        <Section id="overdue-tasks" title="Overdue tasks">
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

        <Section id="overdue-milestones" title="Overdue milestones">
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

        <Section id="pending-approvals" title="Pending formulation approvals">
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

        <Section id="overdue-invoices" title="Overdue invoices">
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
        <Stat label="Your projects" value={d.projectIds.length} href="#your-active-projects" />
        <Stat
          label="Overdue tasks"
          value={d.overdueTasks.length}
          warn={d.overdueTasks.length > 0}
          href="#overdue-tasks"
        />
        <Stat
          label="Overdue milestones"
          value={d.overdueMilestones.length}
          warn={d.overdueMilestones.length > 0}
          href="#overdue-milestones"
        />
        <Stat
          label="Pending your approval"
          value={d.pendingApprovals.length}
          warn={d.pendingApprovals.length > 0}
          href="#pending-your-approval"
        />
      </div>

      <div className="fm-section-grid">
        {/* 29 Oct 2026 (second pass), item #6: active work, not just
            overdue/exception items — so a Project Lead with nothing
            overdue still sees what's actually in flight. */}
        <Section id="your-active-projects" title="Your active projects">
          {d.activeProjects.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.activeProjects.map((p: typeof d.activeProjects[number]) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`}>{p.name}</Link>
                  <span className="fm-li-meta">
                    {p.taskCount} task{p.taskCount === 1 ? "" : "s"} · {p.openMilestoneCount} open milestone
                    {p.openMilestoneCount === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Formulations in flight">
          {d.inFlightFormulations.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.inFlightFormulations.map((v: typeof d.inFlightFormulations[number]) => (
                <li key={v.id}>
                  <Link href={`/formulation-versions/${v.id}`}>
                    {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v
                    {v.versionNumber}
                  </Link>
                  <span className="fm-li-meta">{v.status} · by {v.author.name}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="overdue-tasks" title="Overdue tasks">
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

        <Section id="overdue-milestones" title="Overdue milestones">
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

        <Section id="pending-your-approval" title="Formulations pending your approval">
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
        <Stat
          label="Your open tasks"
          value={d.myTasks.length}
          warn={d.myTasks.length > 0}
          href="#your-open-tasks"
        />
        <Stat label="Drafts to submit" value={d.draftVersions.length} href="#draft-formulations" />
        <Stat
          label="Rejected — needs revision"
          value={d.rejectedVersions.length}
          warn={d.rejectedVersions.length > 0}
          href="#rejected-needs-revision"
        />
        <Stat label="Open trials" value={d.myTrials.length} href="#open-trials" />
      </div>

      <div className="fm-section-grid">
        <Section id="your-open-tasks" title="Your open tasks">
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

        <Section id="draft-formulations" title="Draft formulations (not yet submitted)">
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

        <Section id="rejected-needs-revision" title="Rejected — needs revision">
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

        <Section id="open-trials" title="Open trials">
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

        {/* 29 Oct 2026 (second pass), item #6: low-stock flags from item
            #1, surfaced here so an NPD Executive doesn't have to go check
            /raw-materials just to see if anything needs reordering. */}
        <Section title="Raw materials running low">
          {d.lowStock.length === 0 ? (
            <Empty />
          ) : (
            <ul>
              {d.lowStock.map((m: typeof d.lowStock[number]) => (
                <li key={m.id}>
                  <Link href="/raw-materials">{m.name}</Link>
                  <span className="fm-li-meta">
                    {m.stockOnHand.toString()} {m.defaultUnit} on hand · warn below {m.reorderThreshold?.toString()}
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

// 29 Oct 2026 (fourth pass): confirmed with the user — a stat tile for
// "active project[s]" or "active approval[s]" should navigate to the
// specific place to take action, not just sit there as a number next to a
// list of links. `href` is optional because not every stat has one obvious
// destination (e.g. Admin's "Unverified payments" is a company-wide count
// with no single list page — verification happens per-invoice) — those
// stay plain, non-clickable tiles exactly as before.
function Stat({ label, value, warn, href }: { label: string; value: number; warn?: boolean; href?: string }) {
  const className = `glass glass-sm fm-stat${warn ? " fm-stat-warn" : ""}${href ? " fm-stat-link" : ""}`;
  const content = (
    <>
      <div className="fm-stat-value">
        <StatValue value={value} />
      </div>
      <div className="fm-stat-label">{label}</div>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

// `id` lets a Stat tile above link straight to its matching Section via a
// same-page anchor (e.g. "Pending approvals" → #pending-approvals) instead
// of only being informational next to the list that already links out.
function Section({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} className="glass glass-sm glass-card fm-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Empty() {
  return <p className="fm-empty">Nothing here right now.</p>;
}
