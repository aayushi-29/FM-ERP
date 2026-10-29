import Link from "next/link";
import type { Metadata } from "next";
import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { canManageInventory } from "@/lib/inventory/scope";
import { NewSupplierForm } from "./new-supplier-form";
import { NewRawMaterialForm } from "./new-raw-material-form";
import { CoaUploadForm } from "./coa-upload-form";
import { StockMovementForm } from "./stock-movement-form";
import { SetStockForm } from "./set-stock-form";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Raw Materials" };

// "Add inventory management/supplier details of the raw materials used" —
// the catalog view of Supplier/RawMaterial. 29 Oct 2026: now also shows
// stock-on-hand and a low-stock flag — confirmed with the user to
// explicitly supersede Decision #7's "no stock ledger" (docs/decisions.md).
//
// 29 Oct 2026 (third pass): renamed to "Raw Materials". The earlier pass
// added a separate "Quantity" column, but it read the exact same
// RawMaterial.stockOnHand value as "Stock on hand" — there's no distinct
// quantity field in the schema (prisma/schema.prisma) — so that duplicate
// column was removed. "Stock on hand" (with its low-stock badge and
// "warns below N" threshold note) is now the single number, same as before.
export default async function RawMaterialsPage() {
  const user = await requireRoleOrRedirect(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);
  const canManage = canManageInventory(user.role);

  const [suppliers, rawMaterials] = await Promise.all([
    prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        contactPersonName: true,
        contactPhone: true,
        _count: { select: { materials: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.rawMaterial.findMany({
      select: {
        id: true,
        name: true,
        defaultUnit: true,
        defaultCostPerUnit: true,
        stockOnHand: true,
        reorderThreshold: true,
        supplier: { select: { id: true, name: true } },
        attachments: {
          select: { id: true, fileName: true, uploadedAt: true, uploadedBy: { select: { name: true } } },
          orderBy: { uploadedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const lowStockCount = rawMaterials.filter(
    (m) => m.reorderThreshold != null && Number(m.stockOnHand) <= Number(m.reorderThreshold)
  ).length;

  return (
    <Shell user={user}>
      <nav className="fm-breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard">Dashboard</Link>
        <span>/</span>
        <span>Materials</span>
      </nav>
      <div className="fm-page-head">
        <h1>Raw Materials</h1>
        <p>
          See every supplier and the raw materials bought from them, keep stock counts up to
          date, and get a warning here as soon as something runs low.
        </p>
      </div>
      {lowStockCount > 0 ? (
        <p className="fm-badge fm-badge-warn" style={{ marginBottom: 16 }} role="status">
          ⚠ {lowStockCount} material{lowStockCount === 1 ? "" : "s"} running low — check the Low stock badges below.
        </p>
      ) : null}

      <div className="glass glass-sm glass-card fm-section" style={{ marginBottom: 18 }}>
        <h3>Suppliers</h3>
        {suppliers.length === 0 ? (
          <p className="fm-empty">No suppliers yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {suppliers.map((s) => (
              <li key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid rgba(90,70,40,0.14)", fontSize: ".9rem" }}>
                <strong>{s.name}</strong>
                <span className="fm-li-meta" style={{ display: "inline" }}>
                  {s.contactPersonName ? ` · ${s.contactPersonName}` : ""}
                  {s.contactPhone ? ` · ${s.contactPhone}` : ""}
                  {` · ${s._count.materials} material${s._count.materials === 1 ? "" : "s"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <div style={{ marginTop: 10 }}>
            <NewSupplierForm />
          </div>
        ) : null}
      </div>

      <div className="fm-table-card">
        <h3>Raw materials</h3>
        {rawMaterials.length === 0 ? (
          <p className="fm-empty">No raw materials yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Supplier</th>
                  <th>Unit</th>
                  <th>Price per unit</th>
                  <th>Stock on hand</th>
                  <th>COA images</th>
                </tr>
              </thead>
              <tbody>
                {rawMaterials.map((m) => {
                  const isLow = m.reorderThreshold != null && Number(m.stockOnHand) <= Number(m.reorderThreshold);
                  return (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.supplier?.name ?? "—"}</td>
                      <td>{m.defaultUnit}</td>
                      <td>{m.defaultCostPerUnit ? `₹${m.defaultCostPerUnit.toString()}` : "—"}</td>
                      <td>
                        <div>
                          <strong>
                            {m.stockOnHand.toString()} {m.defaultUnit}
                          </strong>
                          {isLow ? (
                            <span className="fm-badge fm-badge-warn" style={{ marginLeft: 8 }}>
                              Low stock
                            </span>
                          ) : null}
                        </div>
                        {m.reorderThreshold != null ? (
                          <div className="fm-li-meta">warns below {m.reorderThreshold.toString()} {m.defaultUnit}</div>
                        ) : null}
                        {canManage ? (
                          <div style={{ marginTop: 6 }}>
                            <StockMovementForm rawMaterialId={m.id} />
                            <SetStockForm rawMaterialId={m.id} currentStock={m.stockOnHand.toString()} />
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {m.attachments.length === 0 ? (
                          <span className="fm-li-meta">None yet</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {m.attachments.map((a) => (
                              <li key={a.id}>
                                <a href={`/api/raw-material-attachments/${a.id}/download`}>{a.fileName}</a>
                                <span className="fm-li-meta" style={{ display: "inline" }}>
                                  {" · "}{a.uploadedBy.name} · {new Date(a.uploadedAt).toLocaleDateString()}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {canManage ? <CoaUploadForm rawMaterialId={m.id} /> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {canManage ? (
          <div style={{ marginTop: 14 }}>
            <NewRawMaterialForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
