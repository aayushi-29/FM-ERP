"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Supplier = { id: string; name: string };

export function NewRawMaterialForm({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [defaultUnit, setDefaultUnit] = useState("");
  const [defaultCostPerUnit, setDefaultCostPerUnit] = useState("");
  const [reorderThreshold, setReorderThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/raw-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          supplierId: supplierId || undefined,
          defaultUnit,
          defaultCostPerUnit: defaultCostPerUnit || undefined,
          reorderThreshold: reorderThreshold || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the raw material.");
        return;
      }
      setName("");
      setSupplierId("");
      setDefaultUnit("");
      setDefaultCostPerUnit("");
      setReorderThreshold("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 600, flexWrap: "wrap", alignItems: "flex-end" }}>
      <label style={{ flex: 1, minWidth: 160 }}>
        Material name
        <input value={name} onChange={(e) => setName(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label style={{ minWidth: 160 }}>
        Supplier (optional)
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }}>
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label style={{ width: 100 }}>
        Unit
        <input value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)} placeholder="kg" required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label style={{ width: 140 }}>
        Ref. cost/unit (optional)
        <input value={defaultCostPerUnit} onChange={(e) => setDefaultCostPerUnit(e.target.value)} placeholder="e.g. 120.50" style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label style={{ width: 150 }}>
        Reorder threshold (optional)
        <input value={reorderThreshold} onChange={(e) => setReorderThreshold(e.target.value)} placeholder="e.g. 10" style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add material"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem", width: "100%" }}>{error}</p> : null}
    </form>
  );
}
