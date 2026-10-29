"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026 (second pass): "set current stock" convenience — the person
// enters the number they actually counted, not a +/- adjustment.
export function SetStockForm({ rawMaterialId, currentStock }: { rawMaterialId: string; currentStock: string }) {
  const router = useRouter();
  const [targetStock, setTargetStock] = useState(currentStock);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/raw-materials/${rawMaterialId}/set-stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStock }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not update stock on hand.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
      <label style={{ fontSize: ".78rem", color: "#777", display: "flex", alignItems: "center", gap: 4 }}>
        Set stock to
        <input
          type="number"
          step="0.01"
          min="0"
          value={targetStock}
          onChange={(e) => setTargetStock(e.target.value)}
          required
          style={{ width: 80, padding: 4 }}
        />
      </label>
      <button type="submit" disabled={submitting} style={{ fontSize: ".8rem" }}>
        Update
      </button>
      {error ? <span style={{ color: "#b00020", fontSize: ".78rem" }}>{error}</span> : null}
    </form>
  );
}
