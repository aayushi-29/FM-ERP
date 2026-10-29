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
      <h1>Raw Materials</h1>
      <p style={{ color: "#555", fontSize: ".9rem" }}>
        See every supplier and the raw materials bought from them, keep stock counts up to
        date, and get a warning here as soon as something runs low.
      </p>
      {lowStockCount > 0 ? (
        <p style={{ color: "#b00020", fontWeight: 600, fontSize: ".9rem" }} role="status">
          ⚠ {lowStockCount} material{lowStockCount === 1 ? "" : "s"} running low — check the Low stock badges below.
        </p>
      ) : null}

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Suppliers</h2>
      {suppliers.length === 0 ? (
        <p style={{ color: "#777" }}>No suppliers yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {suppliers.map((s) => (
            <li key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
              <strong>{s.name}</strong>
              <span style={{ color: "#777" }}>
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

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Raw materials</h2>
      {rawMaterials.length === 0 ? (
        <p style={{ color: "#777" }}>No raw materials yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".88rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                <th style={{ padding: "6px 8px" }}>Name</th>
                <th style={{ padding: "6px 8px" }}>Supplier</th>
                <th style={{ padding: "6px 8px" }}>Unit</th>
                <th style={{ padding: "6px 8px" }}>Price per unit</th>
                <th style={{ padding: "6px 8px" }}>Stock on hand</th>
                <th style={{ padding: "6px 8px" }}>COA images</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map((m) => {
                const isLow = m.reorderThreshold != null && Number(m.stockOnHand) <= Number(m.reorderThreshold);
                return (
                <tr key={m.id} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                  <td style={{ padding: "8px" }}>{m.name}</td>
                  <td style={{ padding: "8px" }}>{m.supplier?.name ?? "—"}</td>
                  <td style={{ padding: "8px" }}>{m.defaultUnit}</td>
                  <td style={{ padding: "8px" }}>{m.defaultCostPerUnit ? m.defaultCostPerUnit.toString() : "—"}</td>
                  <td style={{ padding: "8px" }}>
                    <span>
                      {m.stockOnHand.toString()} {m.defaultUnit}
                    </span>
                    {isLow ? (
                      <span
                        style={{
                          marginLeft: 6,
                          display: "inline-block",
                          padding: "1px 7px",
                          borderRadius: 999,
                          background: "#fbe9e6",
                          color: "#b00020",
                          fontWeight: 600,
                          fontSize: ".74rem",
                        }}
                      >
                        Low stock
                      </span>
                    ) : null}
                    {m.reorderThreshold != null ? (
                      <div style={{ color: "#777", fontSize: ".78rem" }}>
                        warn below {m.reorderThreshold.toString()}
                      </div>
                    ) : null}
                    {canManage ? (
                      <>
                        <StockMovementForm rawMaterialId={m.id} />
                        <SetStockForm rawMaterialId={m.id} currentStock={m.stockOnHand.toString()} />
                      </>
                    ) : null}
                  </td>
                  <td style={{ padding: "8px" }}>
                    {m.attachments.length === 0 ? (
                      <span style={{ color: "#777" }}>None yet</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {m.attachments.map((a) => (
                          <li key={a.id}>
                            <a href={`/api/raw-material-attachments/${a.id}/download`}>{a.fileName}</a>
                            <span style={{ color: "#777", fontSize: ".78rem" }}>
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
        <div style={{ marginTop: 10 }}>
          <NewRawMaterialForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      ) : null}
    </Shell>
  );
}
