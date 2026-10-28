"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const FIELDS = [
  ["ingredientCost", "Ingredient cost"],
  ["yieldPercent", "Yield %"],
  ["wastagePercent", "Wastage %"],
  ["packagingCost", "Packaging"],
  ["processingCost", "Processing"],
  ["labourCost", "Labour"],
  ["testingCost", "Testing"],
  ["overheadCost", "Overhead"],
  ["batchSizeUnits", "Units per batch"],
] as const;

export function NewCostSheetForm({
  projectId,
  formulationVersions,
}: {
  projectId: string;
  formulationVersions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [formulationVersionId, setFormulationVersionId] = useState(formulationVersions[0]?.id ?? "");
  const [priceBasis, setPriceBasis] = useState<"ESTIMATE" | "SUPPLIER_QUOTE" | "ACTUAL">("ESTIMATE");
  const [values, setValues] = useState<Record<string, string>>({});
  const [markupPercent, setMarkupPercent] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!formulationVersionId) {
      setError("Create a formulation version first — there's nothing to price yet.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cost-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formulationVersionId,
          priceBasis,
          notes: notes || undefined,
          markupPercent: markupPercent || undefined,
          ...Object.fromEntries(FIELDS.map(([key]) => [key, values[key] || "0"])),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the cost sheet.");
        return;
      }
      setValues({});
      setMarkupPercent("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (formulationVersions.length === 0) {
    return <p style={{ color: "#777", fontSize: ".85rem" }}>No formulation versions in this project yet — price one once NPD has created a version.</p>;
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 }}>
      <label>
        Formulation version
        <select value={formulationVersionId} onChange={(e) => setFormulationVersionId(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }}>
          {formulationVersions.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </label>
      <label>
        Price basis
        <select value={priceBasis} onChange={(e) => setPriceBasis(e.target.value as typeof priceBasis)} style={{ display: "block", width: "100%", padding: 6 }}>
          <option value="ESTIMATE">Estimate</option>
          <option value="SUPPLIER_QUOTE">Supplier quote</option>
          <option value="ACTUAL">Actual</option>
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {FIELDS.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              value={values[key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder="0"
              required
              style={{ display: "block", width: "100%", padding: 6 }}
            />
          </label>
        ))}
      </div>
      <label>
        Markup % (optional — suggests a selling price only, needs accountant sign-off)
        <input
          value={markupPercent}
          onChange={(e) => setMarkupPercent(e.target.value)}
          placeholder="e.g. 25"
          style={{ display: "block", width: "100%", padding: 6 }}
        />
      </label>
      <label>
        Notes (assumptions)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <button type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>{submitting ? "Saving…" : "Save cost sheet"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </form>
  );
}
