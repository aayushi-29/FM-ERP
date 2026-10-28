"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Line = {
  id: string;
  materialName: string;
  quantity: string;
  unit: string;
  percentage: string | null;
  technicalNotes: string | null;
};

export function IngredientLines({
  versionId,
  lines,
  editable,
}: {
  versionId: string;
  lines: Line[];
  editable: boolean; // DRAFT status + NPD Executive/Admin
}) {
  const router = useRouter();
  const [materialName, setMaterialName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [percentage, setPercentage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/formulation-versions/${versionId}/ingredient-lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialName,
          quantity,
          unit,
          percentage: percentage || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add that ingredient line.");
        return;
      }
      setMaterialName("");
      setQuantity("");
      setUnit("");
      setPercentage("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/ingredient-lines/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not remove that line.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}

      {lines.length === 0 ? (
        <p style={{ color: "#777" }}>No ingredient lines yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".92rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th style={{ padding: "4px 6px" }}>Material</th>
              <th style={{ padding: "4px 6px" }}>Quantity</th>
              <th style={{ padding: "4px 6px" }}>Unit</th>
              <th style={{ padding: "4px 6px" }}>%</th>
              {editable ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "4px 6px" }}>{line.materialName}</td>
                <td style={{ padding: "4px 6px" }}>{line.quantity}</td>
                <td style={{ padding: "4px 6px" }}>{line.unit}</td>
                <td style={{ padding: "4px 6px" }}>{line.percentage ?? "—"}</td>
                {editable ? (
                  <td style={{ padding: "4px 6px" }}>
                    <button disabled={deletingId === line.id} onClick={() => handleDelete(line.id)}>
                      {deletingId === line.id ? "Removing…" : "Remove"}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editable ? (
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
          <label style={{ minWidth: 160 }}>
            Material
            <input value={materialName} onChange={(e) => setMaterialName(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
          </label>
          <label style={{ width: 100 }}>
            Quantity
            <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 12.5" required style={{ display: "block", width: "100%", padding: 6 }} />
          </label>
          <label style={{ width: 90 }}>
            Unit
            <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, g, %…" required style={{ display: "block", width: "100%", padding: 6 }} />
          </label>
          <label style={{ width: 90 }}>
            % (optional)
            <input value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="e.g. 10" style={{ display: "block", width: "100%", padding: 6 }} />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add line"}</button>
        </form>
      ) : null}
    </div>
  );
}
