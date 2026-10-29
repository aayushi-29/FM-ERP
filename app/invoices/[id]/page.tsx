import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { canReadInvoices, canManageInvoices, isInvoiceVisibleToClient } from "@/lib/costing/scope";
import { InvoiceActions } from "./invoice-actions";
import { ClaimPaymentForm } from "./claim-payment-form";
import { PendingClaimActions } from "./pending-claim-actions";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  if (!canReadInvoices(user.role)) redirect("/forbidden");

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      lines: true,
      payments: { orderBy: { receivedAt: "desc" } },
      creditNotes: { orderBy: { issuedAt: "desc" } },
      createdBy: { select: { name: true } },
      paymentClaims: { orderBy: { submittedAt: "desc" } },
    },
  });
  if (!invoice) notFound();

  await assertProjectAccessOrRedirect(user, invoice.projectId);
  if (user.role === "CLIENT" && !isInvoiceVisibleToClient(invoice.status)) notFound();

  const totalPaid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalCredited = invoice.creditNotes.reduce((sum, c) => sum + Number(c.amount), 0);
  const balance = Number(invoice.amount) - totalCredited - totalPaid;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 640 }}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/projects/${invoice.projectId}/costing`}>← Costing &amp; Invoicing</Link>
      </p>
      <h1>{invoice.invoiceNumber}</h1>
      <p style={{ color: "#555" }}>
        {invoice.status}
        {invoice.milestoneLabel ? ` · ${invoice.milestoneLabel}` : ""}
        {invoice.dueDate ? ` · due ${new Date(invoice.dueDate).toLocaleDateString()}` : ""}
        {" · prepared by "}{invoice.createdBy.name}
      </p>

      <h2 style={{ fontSize: "1.05rem", marginTop: 20 }}>Lines</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px 4px" }}>{l.description}</td>
              <td style={{ padding: "6px 4px", textAlign: "right" }}>{l.amount.toString()}</td>
            </tr>
          ))}
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "6px 4px", color: "#555" }}>Subtotal</td>
            <td style={{ padding: "6px 4px", textAlign: "right" }}>{invoice.subtotal.toString()}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "6px 4px", color: "#555" }}>Tax</td>
            <td style={{ padding: "6px 4px", textAlign: "right" }}>{invoice.taxAmount.toString()}</td>
          </tr>
          <tr>
            <td style={{ padding: "6px 4px", fontWeight: 600 }}>Total ({invoice.currency})</td>
            <td style={{ padding: "6px 4px", textAlign: "right", fontWeight: 600 }}>{invoice.amount.toString()}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ background: "#f7f7f7", padding: 14, borderRadius: 8, margin: "16px 0" }}>
        <p style={{ margin: 0 }}>Paid so far: {totalPaid.toFixed(2)} {invoice.currency}</p>
        {totalCredited > 0 ? <p style={{ margin: "4px 0 0" }}>Credited: {totalCredited.toFixed(2)} {invoice.currency}</p> : null}
        <p style={{ margin: "4px 0 0", fontWeight: 600 }}>Balance: {balance.toFixed(2)} {invoice.currency}</p>
      </div>

      {invoice.payments.length > 0 ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 20 }}>Payments</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {invoice.payments.map((p) => (
              <li key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
                {p.amount.toString()} {invoice.currency}
                <span style={{ color: "#777" }}>
                  {" · "}{new Date(p.receivedAt).toLocaleDateString()}
                  {p.method ? ` · ${p.method}` : ""}
                  {p.reference ? ` · ref ${p.reference}` : ""}
                  {" · "}{p.verifiedById ? "verified" : "unverified"}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {invoice.creditNotes.length > 0 ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 20 }}>Credit notes</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {invoice.creditNotes.map((c) => (
              <li key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
                {c.amount.toString()} {invoice.currency} — {c.reason}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* 29 Oct 2026 (second pass): Client payment claims — a claim never
          changes this invoice's status or creates a Payment by itself (see
          docs/decisions.md); only Admin's acknowledge/reject below does. */}
      {user.role === "CLIENT" && invoice.status !== "PAID" && invoice.status !== "CANCELLED" ? (
        <ClaimPaymentForm invoiceId={invoice.id} />
      ) : null}

      {invoice.paymentClaims.length > 0 ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 20 }}>
            {user.role === "CLIENT" ? "Your payment claims" : "Payment claims"}
          </h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {invoice.paymentClaims.map((c: (typeof invoice.paymentClaims)[number]) => (
              <li key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
                {c.amount.toString()} {invoice.currency} · {c.paymentMode} · ref {c.acknowledgementOrInvoiceNumber}
                <span style={{ color: "#777" }}>
                  {" · "}
                  {new Date(c.submittedAt).toLocaleDateString()} ·{" "}
                  <strong
                    style={{
                      color: c.status === "ACKNOWLEDGED" ? "#2a7a2a" : c.status === "REJECTED" ? "#b00020" : "#777",
                    }}
                  >
                    {c.status}
                  </strong>
                </span>
                {c.status === "REJECTED" && c.adminNote ? (
                  <div style={{ color: "#b00020", fontSize: ".85rem" }}>Reason: {c.adminNote}</div>
                ) : null}
                {canManageInvoices(user.role) && c.status === "PENDING" ? (
                  <PendingClaimActions claimId={c.id} />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {canManageInvoices(user.role) ? (
        <InvoiceActions
          invoiceId={invoice.id}
          status={invoice.status}
          payments={invoice.payments.map((p) => ({ id: p.id, verified: !!p.verifiedById }))}
        />
      ) : null}
    </main>
  );
}
