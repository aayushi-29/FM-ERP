import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireUserOrRedirect, assertProjectAccessOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { canReadCosting, canManageCosting, canManageInvoices, isInvoiceVisibleToClient } from "@/lib/costing/scope";
import { PAYMENT_STAGE_LABEL } from "@/lib/payments/stage";
import { NewCostSheetForm } from "./new-cost-sheet-form";
import { NewExpenseForm } from "./new-expense-form";
import { NewInvoiceForm } from "./new-invoice-form";

export default async function CostingPage({ params }: { params: { id: string } }) {
  const user = await requireUserOrRedirect();
  // NPD Executive has no row at all here (baseline §4: Costing "No access
  // by default", Invoices/payments "No access") — bounced before even
  // reaching project-access scoping, matching how Products excludes
  // Client entirely.
  if (user.role === "NPD_EXECUTIVE") redirect("/forbidden");
  await assertProjectAccessOrRedirect(user, params.id);

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!project) notFound();

  const canSeeCosting = canReadCosting(user.role);

  const [costSheets, expenses, invoicesRaw, formulationVersions] = await Promise.all([
    canSeeCosting
      ? prisma.costSheet.findMany({
          where: { projectId: params.id },
          select: {
            id: true, priceBasis: true, costPerBatch: true, costPerUnit: true, currency: true, createdAt: true,
            createdBy: { select: { name: true } },
            formulationVersion: { select: { versionNumber: true, formulation: { select: { name: true } } } },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    canSeeCosting
      ? prisma.projectExpense.findMany({
          where: { projectId: params.id },
          select: { id: true, description: true, amount: true, currency: true, incurredAt: true, createdBy: { select: { name: true } } },
          orderBy: { incurredAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.invoice.findMany({
      where: { projectId: params.id },
      select: { id: true, invoiceNumber: true, milestoneLabel: true, paymentStage: true, amount: true, currency: true, status: true, dueDate: true },
      orderBy: { createdAt: "desc" },
    }),
    canSeeCosting
      ? prisma.formulationVersion.findMany({
          where: { formulation: { product: { projectId: params.id } } },
          select: { id: true, versionNumber: true, formulation: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const invoices = user.role === "CLIENT" ? invoicesRaw.filter((i) => isInvoiceVisibleToClient(i.status)) : invoicesRaw;

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 800 }}>
      <p style={{ marginBottom: 4 }}>
        <Link href={`/projects/${project.id}`}>← {project.name}</Link>
      </p>
      <h1>Costing &amp; Invoicing</h1>

      {canSeeCosting ? (
        <>
          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Cost sheets</h2>
          {costSheets.length === 0 ? (
            <p style={{ color: "#777" }}>No cost sheets yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {costSheets.map((cs) => (
                <li key={cs.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
                  <Link href={`/cost-sheets/${cs.id}`}>
                    {cs.formulationVersion.formulation.name} v{cs.formulationVersion.versionNumber}
                  </Link>
                  <span style={{ color: "#777" }}>
                    {" · "}{cs.priceBasis} · {cs.costPerUnit.toString()}/unit ({cs.costPerBatch.toString()} per batch) {cs.currency}
                    {" · by "}{cs.createdBy.name} · {new Date(cs.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManageCosting(user.role) ? (
            <div style={{ marginTop: 10 }}>
              <NewCostSheetForm projectId={project.id} formulationVersions={formulationVersions.map((v) => ({
                id: v.id,
                label: `${v.formulation.name} v${v.versionNumber}`,
              }))} />
            </div>
          ) : null}

          <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Expenses</h2>
          {expenses.length === 0 ? (
            <p style={{ color: "#777" }}>No expenses logged yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0 }}>
              {expenses.map((e) => (
                <li key={e.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
                  {e.description}
                  <span style={{ color: "#777" }}>
                    {" · "}{e.amount.toString()} {e.currency} · {e.createdBy.name} · {new Date(e.incurredAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canManageCosting(user.role) ? (
            <div style={{ marginTop: 10 }}>
              <NewExpenseForm projectId={project.id} />
            </div>
          ) : null}
        </>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Invoices</h2>
      {user.role === "CLIENT" ? (
        <p style={{ color: "#777", fontSize: ".85rem" }}>Showing invoices sent to your organization.</p>
      ) : null}
      {invoices.length === 0 ? (
        <p style={{ color: "#777" }}>No invoices yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {invoices.map((inv) => (
            <li key={inv.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
              <Link href={`/invoices/${inv.id}`}>{inv.invoiceNumber}</Link>
              <span style={{ color: "#777" }}>
                {" · "}{inv.status} · {inv.amount.toString()} {inv.currency}
                {inv.paymentStage ? ` · ${PAYMENT_STAGE_LABEL[inv.paymentStage]}` : ""}
                {inv.milestoneLabel ? ` · ${inv.milestoneLabel}` : ""}
                {inv.dueDate ? ` · due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      {canManageInvoices(user.role) ? (
        <div style={{ marginTop: 10 }}>
          <NewInvoiceForm projectId={project.id} />
        </div>
      ) : null}
    </main>
  );
}
