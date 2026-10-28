"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewExpenseForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, amount }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not log the expense.");
        return;
      }
      setDescription("");
      setAmount("");
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
        Description
        <input value={description} onChange={(e) => setDescription(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label style={{ width: 120 }}>
        Amount
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Log expense"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem", width: "100%" }}>{error}</p> : null}
    </form>
  );
}
