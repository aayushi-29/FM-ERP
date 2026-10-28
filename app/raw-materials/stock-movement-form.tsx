"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026: stock-monitoring addition. Positive = stock added
// (delivery), negative = consumed/wasted/corrected downward — see
// lib/inventory/stock.ts.
export function StockMovementForm({ rawMaterialId }: { rawMaterialId: string }) {
  const router = useRouter();
  const [quantityDelta, setQuantityDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/raw-materials/${rawMaterialId}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantityDelta, reason: reason || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not record this stock movement.");
        return;
      }
      setQuantityDelta("");
      setReason("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
      <input
        value={quantityDelta}
        onChange={(e) => setQuantityDelta(e.target.value)}
        placeholder="±qty"
        required
        style={{ width: 70, padding: 4 }}
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="reason (optional)"
        style={{ width: 130, padding: 4 }}
      />
      <button type="submit" disabled={submitting} style={{ fontSize: ".8rem" }}>
        Record
      </button>
      {error ? <span style={{ color: "#b00020", fontSize: ".78rem" }}>{error}</span> : null}
    </form>
  );
}
