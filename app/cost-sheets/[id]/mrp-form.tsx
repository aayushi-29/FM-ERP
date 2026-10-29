"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026 (second pass): Admin-only. Setting recommendedMrp and
// publishing it are two separate actions — an Admin can save a draft MRP
// without it being visible to the client yet.
export function MrpForm({
  costSheetId,
  currency,
  recommendedMrp,
  published,
}: {
  costSheetId: string;
  currency: string;
  recommendedMrp: string;
  published: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(recommendedMrp);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save(body: { recommendedMrp?: string; publish?: boolean }) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/cost-sheets/${costSheetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the MRP.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    save({ recommendedMrp: value });
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label>
          MRP ({currency})
          <input
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{ display: "block", width: 140, padding: 6 }}
          />
        </label>
        <button type="submit" disabled={pending}>Save</button>
        {!published ? (
          <button type="button" disabled={pending || !value} onClick={() => save({ publish: true })}>
            Publish to client
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => save({ publish: false })}>
            Unpublish
          </button>
        )}
      </form>
      <p style={{ marginTop: 6, fontSize: ".82rem", color: published ? "#2a7a2a" : "#777" }}>
        {published ? "Visible to the client right now." : "Not visible to the client yet."}
      </p>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </div>
  );
}
