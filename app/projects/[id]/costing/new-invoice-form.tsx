"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Line = { description: string; amount: string };

export function NewInvoiceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [milestoneLabel, setMilestoneLabel] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<Line[]>([{ description: "", amount: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanLines = lines.filter((l) => l.description && l.amount);
    if (cleanLines.length === 0) {
      setError("Add at least one line with a description and amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          milestoneLabel: milestoneLabel || undefined,
          taxAmount: taxAmount || "0",
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          lines: cleanLines,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not create the invoice.");
        return;
      }
      const data = await res.json();
      router.push(`/invoices/${data.invoice.id}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 520 }}>
      <label>
        Milestone label (optional)
        <input value={milestoneLabel} onChange={(e) => setMilestoneLabel(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }} />
      </label>

      <div>
        <span style={{ fontSize: ".85rem", fontWeight: 600 }}>Lines</span>
        {lines.map((line, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <input
              placeholder="Description"
              value={line.description}
              onChange={(e) => updateLine(i, "description", e.target.value)}
              style={{ flex: 1, padding: 6 }}
            />
            <input
              placeholder="Amount"
              value={line.amount}
              onChange={(e) => updateLine(i, "amount", e.target.value)}
              style={{ width: 100, padding: 6 }}
            />
          </div>
        ))}
        <button type="button" onClick={() => setLines((p) => [...p, { description: "", amount: "" }])} style={{ marginTop: 4, fontSize: ".82rem" }}>
          + Add line
        </button>
      </div>

      <label style={{ width: 160 }}>
        Tax amount
        <input value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label style={{ width: 200 }}>
        Due date
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }} />
      </label>

      <button type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>{submitting ? "Creating…" : "Create draft invoice"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </form>
  );
}
