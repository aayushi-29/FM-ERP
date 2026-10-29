import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/app/components/shell";

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

  return (
    <Shell user={user}>
      <h1>Client Portal</h1>
      <p style={{ color: "#555", fontSize: ".9rem" }}>
        Status, milestones, approved documents, and invoices for all your projects in one place.
      </p>

      {projects.length === 0 ? (
        <p style={{ color: "#777" }}>No projects yet.</p>
      ) : (
        projects.map((p) => (
          <section key={p.id} style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid #eee" }}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: 2 }}>
              <Link href={`/projects/${p.id}`}>{p.name}</Link>
            </h2>
            <p style={{ color: "#555", fontSize: ".9rem", margin: "2px 0 10px" }}>
              Status: {p.status}
              {p.targetDate ? ` · target ${new Date(p.targetDate).toLocaleDateString()}` : ""}
              {p.lead ? ` · led by ${p.lead.name}` : ""}
            </p>

            {!p.advancePaymentVerifiedAt ? (
              <p className="fm-advance-banner" role="status" style={{ fontSize: ".85rem" }}>
                Work on this project starts once your 60% advance payment is verified.
              </p>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 8 }}>
              <div>
                <h3 style={{ fontSize: ".92rem" }}>Milestones</h3>
                {p.milestones.length === 0 ? (
                  <p style={{ color: "#777", fontSize: ".85rem" }}>None yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, fontSize: ".85rem" }}>
                    {p.milestones.map((m) => (
                      <li key={m.id} style={{ padding: "4px 0", borderBottom: "1px solid #f3f3f3" }}>
                        {m.title}
                        <span style={{ color: "#777" }}>
                          {" · "}{m.status}
                          {m.dueDate ? ` · due ${new Date(m.dueDate).toLocaleDateString()}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: ".92rem" }}>Approved documents</h3>
                {p.documents.length === 0 ? (
                  <p style={{ color: "#777", fontSize: ".85rem" }}>None shared yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, fontSize: ".85rem" }}>
                    {p.documents.map((d) => (
                      <li key={d.id} style={{ padding: "4px 0", borderBottom: "1px solid #f3f3f3" }}>
                        {d.type}
                        <span style={{ color: "#777" }}>
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
                <h3 style={{ fontSize: ".92rem" }}>Invoices</h3>
                {p.invoices.length === 0 ? (
                  <p style={{ color: "#777", fontSize: ".85rem" }}>None yet.</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, fontSize: ".85rem" }}>
                    {p.invoices.map((inv) => (
                      <li key={inv.id} style={{ padding: "4px 0", borderBottom: "1px solid #f3f3f3" }}>
                        <Link href={`/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
                        <span style={{ color: "#777" }}>
                          {" · "}{inv.amount.toString()} · {inv.status}
                          {inv.paymentStage ? ` · ${inv.paymentStage}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ))
      )}
    </Shell>
  );
}
