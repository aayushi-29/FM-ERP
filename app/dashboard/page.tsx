import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import type { SessionUser } from "@/lib/auth/session";
import {
  getAdminDashboard,
  getProjectLeadDashboard,
  getNpdExecutiveDashboard,
  getClientDashboard,
} from "@/lib/dashboard/queries";
import { SignOutButton } from "./sign-out-button";

// Role-specific landing view (baseline §11). Each branch below is a plain
// read-only summary built from the already-scoped queries in
// lib/dashboard/queries.ts — it is not its own access path, so every
// list here is something the role could already see by navigating to the
// underlying page; this just surfaces what needs attention first.

function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString() : "—";
}

export default async function DashboardPage() {
  const user = await requireUserOrRedirect();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Welcome, {user.name}</h1>
        <SignOutButton />
      </div>
      <p style={{ color: "#555" }}>
        Signed in as <strong>{user.role}</strong>.
      </p>

      <nav style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        {user.role === "ADMIN" ? <Link href="/admin/users">Users</Link> : null}
        {user.role === "ADMIN" ? <Link href="/admin/audit-log">Audit log</Link> : null}
        {user.role === "ADMIN" || user.role === "PROJECT_LEAD" ? <Link href="/clients">Clients</Link> : null}
        <Link href="/projects">Projects</Link>
      </nav>

      {user.role === "ADMIN" ? <AdminSection /> : null}
      {user.role === "PROJECT_LEAD" ? <ProjectLeadSection user={user} /> : null}
      {user.role === "NPD_EXECUTIVE" ? <NpdExecutiveSection user={user} /> : null}
      {user.role === "CLIENT" ? <ClientSection user={user} /> : null}
    </main>
  );
}

async function AdminSection() {
  const d = await getAdminDashboard();

  return (
    <>
      <div style={{ display: "flex", gap: 24, margin: "16px 0", flexWrap: "wrap" }}>
        <Stat label="Active projects" value={d.activeProjects} />
        <Stat label="Overdue tasks" value={d.overdueTasks.length} warn={d.overdueTasks.length > 0} />
        <Stat label="Overdue milestones" value={d.overdueMilestones.length} warn={d.overdueMilestones.length > 0} />
        <Stat label="Pending formulation approvals" value={d.pendingApprovals.length} warn={d.pendingApprovals.length > 0} />
        <Stat label="Overdue invoices" value={d.overdueInvoices.length} warn={d.overdueInvoices.length > 0} />
        <Stat label="Unverified payments" value={d.unverifiedPayments} warn={d.unverifiedPayments > 0} />
      </div>

      <Section title="Overdue tasks">
        {d.overdueTasks.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {d.overdueTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> — {t.title}
                {t.assignee ? ` (${t.assignee.name})` : ""} · due {fmtDate(t.dueDate)}
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
                <Link href={`/projects/${m.project.id}`}>{m.project.name}</Link> — {m.title} · due {fmtDate(m.dueDate)}
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
                  {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v{v.versionNumber}
                </Link>{" "}
                · submitted {fmtDate(v.submittedAt)}
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
                </Link>{" "}
                · {inv.amount.toString()} · due {fmtDate(inv.dueDate)}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

async function ProjectLeadSection({ user }: { user: SessionUser }) {
  const d = await getProjectLeadDashboard(user);

  if (d.projectIds.length === 0) {
    return (
      <p style={{ color: "#555", marginTop: 24 }}>
        No projects assigned yet — <Link href="/projects">browse projects</Link>.
      </p>
    );
  }

  return (
    <>
      <div style={{ display: "flex", gap: 24, margin: "16px 0", flexWrap: "wrap" }}>
        <Stat label="Your projects" value={d.projectIds.length} />
        <Stat label="Overdue tasks" value={d.overdueTasks.length} warn={d.overdueTasks.length > 0} />
        <Stat label="Overdue milestones" value={d.overdueMilestones.length} warn={d.overdueMilestones.length > 0} />
        <Stat label="Pending your approval" value={d.pendingApprovals.length} warn={d.pendingApprovals.length > 0} />
      </div>

      <Section title="Overdue tasks">
        {d.overdueTasks.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {d.overdueTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> — {t.title}
                {t.assignee ? ` (${t.assignee.name})` : ""} · due {fmtDate(t.dueDate)}
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
                <Link href={`/projects/${m.project.id}`}>{m.project.name}</Link> — {m.title} · due {fmtDate(m.dueDate)}
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
                  {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v{v.versionNumber}
                </Link>{" "}
                · submitted {fmtDate(v.submittedAt)}
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
                </Link>{" "}
                · {inv.amount.toString()} · {inv.status} · due {fmtDate(inv.dueDate)}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

async function NpdExecutiveSection({ user }: { user: SessionUser }) {
  const d = await getNpdExecutiveDashboard(user);

  return (
    <>
      <div style={{ display: "flex", gap: 24, margin: "16px 0", flexWrap: "wrap" }}>
        <Stat label="Your open tasks" value={d.myTasks.length} warn={d.myTasks.length > 0} />
        <Stat label="Drafts to submit" value={d.draftVersions.length} />
        <Stat label="Rejected — needs revision" value={d.rejectedVersions.length} warn={d.rejectedVersions.length > 0} />
        <Stat label="Open trials" value={d.myTrials.length} />
      </div>

      <Section title="Your open tasks">
        {d.myTasks.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {d.myTasks.map((t) => (
              <li key={t.id}>
                <Link href={`/projects/${t.project.id}`}>{t.project.name}</Link> — {t.title} · due {fmtDate(t.dueDate)}
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
                  {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v{v.versionNumber}
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
                  {v.formulation.product.project.name} — {v.formulation.product.name} / {v.formulation.name} v{v.versionNumber}
                </Link>{" "}
                · rejected {fmtDate(v.decidedAt)}
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
                {t.formulationVersion.versionNumber} · {t.status}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

async function ClientSection({ user }: { user: SessionUser }) {
  const d = await getClientDashboard(user);

  return (
    <>
      <Section title="Your projects">
        {d.projects.length === 0 ? (
          <Empty />
        ) : (
          <ul>
            {d.projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`}>{p.name}</Link> · {p.status}
                {p.targetDate ? ` · target ${fmtDate(p.targetDate)}` : ""}
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
                <Link href={`/projects/${doc.project.id}/documents`}>{doc.project.name}</Link> — {doc.type} ·{" "}
                {fmtDate(doc.createdAt)}
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
                </Link>{" "}
                · {inv.amount.toString()} · {inv.status} · due {fmtDate(inv.dueDate)}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: "10px 14px", minWidth: 140 }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 600, color: warn ? "#b42318" : "#111" }}>{value}</div>
      <div style={{ fontSize: ".8rem", color: "#555" }}>{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>{title}</h2>
      {children}
    </>
  );
}

function Empty() {
  return <p style={{ color: "#888", fontSize: ".9rem" }}>Nothing here right now.</p>;
}
