import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Client Portal" };

// 29 Oct 2026: dedicated Client Portal page — confirmed with the user.
// Baseline §11 describes the Client's own view as "own project status,
// milestones, approved documents, invoices" — all of that already existed
// (the Client branch of /dashboard, and the per-project Client view in
// app/projects/[id]/page.tsx), but only as links to click through to each
// project separately. This page is the single consolidated landing view
// the baseline describes, grouped by project rather than split across
// pages. It doesn't replace the per-project Client view or the dashboard
// (both still work exactly as before) — it's an additional, more complete
// summary.
export default async function ClientPortalPage() {
  const user = await requireUserOrRedirect();
  if (user.role !== "CLIENT") redirect("/dashboard");
  if (!user.clientOrgId) {
    return (
      <Shell user={user}>
        <h1>Client Portal</h1>
        <p style={{ color: "#777" }}>Your account isn&apos;t linked to a client organization yet.</p>
      </Shell>
    );
  }

  const projects = await prisma.project.findMany({
    where: { clientOrgId: user.clientOrgId },
    select: {
      id: true,
      name: true,
      status: true,
      targetDate: true,
      advancePaymentVerifiedAt: true,
      lead: { select: { name: true } },
      milestones: {
        select: { id: true, title: true, status: true, dueDate: true },
        orderBy: { dueDate: "asc" },
      },
      documents: {
        where: { visibility: "CLIENT_VISIBLE" },
        select: { id: true, type: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        select: { id: true, invoiceNumber: true, amount: true, status: true, dueDate: true, paymentStage: true },
        orderBy: { dueDate: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusBadgeClass: Record<string, string> = {
    ACTIVE: "fm-badge fm-badge-good",
    ON_HOLD: "fm-badge fm-badge-gold",
    COMPLETED: "fm-badge",
    CANCELLED: "fm-badge fm-badge-warn",
  };

  return (
    <Shell user={user}>
      <div className="fm-page-head">
        <h1>Client Portal</h1>
        <p>Status, milestones, approved documents, and invoices for all your projects in one place.</p>
      </div>

      {projects.length === 0 ? (
        <p className="fm-empty">No projects yet.</p>
      ) : (
        <div className="fm-section-grid" style={{ gridTemplateColumns: "1fr" }}>
        {projects.map((p) => {
          // Client never sees a DRAFT invoice — same rule as everywhere
          // else (lib/costing/scope.ts's isInvoiceVisibleToClient); this
          // list wasn't filtering that out before, so a not-yet-sent draft
          // could show up here and 404 when clicked.
          const visibleInvoices = p.invoices.filter((inv: (typeof p.invoices)[number]) => inv.status !== "DRAFT");
          const advanceInvoice = !p.advancePaymentVerifiedAt
            ? visibleInvoices.find((inv: (typeof visibleInvoices)[number]) => inv.paymentStage === "ADVANCE_60")
            : undefined;

          return (
          <div key={p.id} className="glass glass-sm glass-card fm-section">
            <div className="fm-entity-card-head" style={{ marginBottom: 2 }}>
              <div>
                <h3 style={{ fontSize: "1.1rem" }}>
                  <Link href={`/projects/${p.id}`}>{p.name}</Link>
                </h3>
                <p className="fm-li-meta">
                  {p.targetDate ? `Target ${new Date(p.targetDate).toLocaleDateString()}` : ""}
                  {p.lead ? ` · led by ${p.lead.name}` : ""}
                </p>
              </div>
              <span className={statusBadgeClass[p.status] ?? "fm-badge"}>{p.status}</span>
            </div>

            {!p.advancePaymentVerifiedAt ? (
              <p className="fm-advance-banner" role="status" style={{ fontSize: ".85rem" }}>
                Work on this project starts once your 60% advance payment is verified.
                {advanceInvoice ? (
                  <>
                    {" "}
                    <Link href={`/invoices/${advanceInvoice.id}`} style={{ fontWeight: 600 }}>
                      Pay {advanceInvoice.amount.toString()} now →
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}

            <div className="fm-section-grid" style={{ marginTop: 14, marginBottom: 0 }}>
              <div>
                <h3>Milestones</h3>
                {p.milestones.length === 0 ? (
                  <p className="fm-empty">None yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, fontSize: ".85rem" }}>
                    {p.milestones.map((m) => (
                      <li key={m.id} style={{ padding: "4px 0", borderBottom: "1px solid rgba(90,70,40,0.14)" }}>
                        {m.title}
                        <span className="fm-li-meta" style={{ display: "inline" }}>
                          {" · "}{m.status}
                          {m.dueDate ? ` · due ${new Date(m.dueDate).toLocaleDateString()}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3>Approved documents</h3>
                {p.documents.length === 0 ? (
                  <p className="fm-empty">None shared yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, fontSize: ".85rem" }}>
                    {p.documents.map((d) => (
                      <li key={d.id} style={{ padding: "4px 0", borderBottom: "1px solid rgba(90,70,40,0.14)" }}>
                        {d.type}
                        <span className="fm-li-meta" style={{ display: "inline" }}>
                          {" · "}{new Date(d.createdAt).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={`/projects/${p.id}/documents`} style={{ fontSize: ".82rem" }}>
                  Open documents →
                </Link>
              </div>

              <div>
                <h3>Invoices</h3>
                {visibleInvoices.length === 0 ? (
                  <p className="fm-empty">None yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, fontSize: ".85rem" }}>
                    {visibleInvoices.map((inv) => (
                      <li key={inv.id} style={{ padding: "4px 0", borderBottom: "1px solid rgba(90,70,40,0.14)" }}>
                        <Link href={`/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                        <span className="fm-li-meta" style={{ display: "inline" }}>
                          {" · "}{inv.amount.toString()} · {inv.status}
                          {inv.paymentStage ? ` · ${inv.paymentStage}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          );
        })}
        </div>
      )}
    </Shell>
  );
}
