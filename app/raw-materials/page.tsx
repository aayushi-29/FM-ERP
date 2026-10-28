import { requireRoleOrRedirect } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { canManageInventory } from "@/lib/inventory/scope";
import { NewSupplierForm } from "./new-supplier-form";
import { NewRawMaterialForm } from "./new-raw-material-form";
import { CoaUploadForm } from "./coa-upload-form";

// "Add inventory management/supplier details of the raw materials used" —
// Decision #7 still stands (records only, no stock ledger/quantities on
// hand); this is the catalog view of Supplier/RawMaterial, which already
// existed in the schema but had no UI until now. Internal tooling, same
// plain styling as /leads, /clients, /projects (not yet themed).
export default async function RawMaterialsPage() {
  const user = await requireRoleOrRedirect(["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE"]);
  const canManage = canManageInventory(user.role);

  const [suppliers, rawMaterials] = await Promise.all([
    prisma.supplier.findMany({
      select: { id: true, name: true, contact: true, _count: { select: { materials: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.rawMaterial.findMany({
      select: {
        id: true,
        name: true,
        defaultUnit: true,
        defaultCostPerUnit: true,
        supplier: { select: { id: true, name: true } },
        attachments: {
          select: { id: true, fileName: true, uploadedAt: true, uploadedBy: { select: { name: true } } },
          orderBy: { uploadedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: 900 }}>
      <h1>Raw materials &amp; suppliers</h1>
      <p style={{ color: "#555", fontSize: ".9rem" }}>
        Company-wide catalog of suppliers and the raw materials sourced from them, with Certificate
        of Analysis images attached per material. Records only — no stock-on-hand tracking yet.
      </p>

      <h2 style={{ fontSize: "1.05rem", marginTop: 24 }}>Suppliers</h2>
      {suppliers.length === 0 ? (
        <p style={{ color: "#777" }}>No suppliers yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {suppliers.map((s) => (
            <li key={s.id} style={{ padding: "6px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
              <strong>{s.name}</strong>
              <span style={{ color: "#777" }}>
                {s.contact ? ` · ${s.contact}` : ""}
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
                <th style={{ padding: "6px 8px" }}>Ref. cost/unit</th>
                <th style={{ padding: "6px 8px" }}>COA images</th>
              </tr>
            </thead>
            <tbody>
              {rawMaterials.map((m) => (
                <tr key={m.id} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                  <td style={{ padding: "8px" }}>{m.name}</td>
                  <td style={{ padding: "8px" }}>{m.supplier?.name ?? "—"}</td>
                  <td style={{ padding: "8px" }}>{m.defaultUnit}</td>
                  <td style={{ padding: "8px" }}>{m.defaultCostPerUnit ? m.defaultCostPerUnit.toString() : "—"}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canManage ? (
        <div style={{ marginTop: 10 }}>
          <NewRawMaterialForm suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))} />
        </div>
      ) : null}
    </main>
  );
}
