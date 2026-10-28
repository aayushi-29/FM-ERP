"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewFormulationForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/products/${productId}/formulations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the formulation.");
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", maxWidth: 480 }}>
      <label style={{ flex: 1, minWidth: 160 }}>
        Formulation name
        <input value={name} onChange={(e) => setName(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Start v1 draft"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem", width: "100%" }}>{error}</p> : null}
    </form>
  );
}
