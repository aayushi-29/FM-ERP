"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export type BatchRow = {
  id: string;
  receivedQty: string;
  remainingQty: string;
  receivedAt: string;
  expiresAt: string | null;
  usedQty: string;
  wastedQty: string;
};

// 11 Nov 2026: category-aware stock batches — confirmed with the user.
// Additive to the existing StockMovementForm/SetStockForm (those still
// adjust the pooled stockOnHand total exactly as before); this is the new,
// opt-in per-delivery view: receive a batch, then log how much of it got
// used or wasted, so "received vs used vs wasted vs remaining" is a real,
// reportable number instead of a note buried in a free-text reason.
export function BatchPanel({
  rawMaterialId,
  defaultUnit,
  category,
  batches,
}: {
  rawMaterialId: string;
  defaultUnit: string;
  category: "STANDARD" | "PERISHABLE" | "PACKAGING";
  batches: BatchRow[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleReceive(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/raw-materials/${rawMaterialId}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not record the batch.");
        return;
      }
      setQuantity("");
      setExpiresAt("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  const now = Date.now();

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid rgba(90,70,40,0.14)", paddingTop: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fm-btn-ghost"
        style={{ fontSize: ".82rem", padding: "2px 0" }}
      >
        {open ? "Hide batches ▲" : `Batches (${batches.length}) ▼`}
      </button>

      {open ? (
        <div style={{ marginTop: 8 }}>
          {batches.length === 0 ? (
            <p className="fm-empty" style={{ margin: "4px 0" }}>No batches logged yet.</p>
          ) : (
            <table style={{ fontSize: ".82rem", width: "100%", marginBottom: 10 }}>
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Qty in</th>
                  <th>Used</th>
                  {category === "PERISHABLE" ? <th>Wasted</th> : null}
                  <th>Remaining</th>
                  {category === "PERISHABLE" ? <th>Expiry</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const expired = b.expiresAt ? new Date(b.expiresAt).getTime() < now : false;
                  const remaining = Number(b.remainingQty);
                  return (
                    <tr key={b.id}>
                      <td>{new Date(b.receivedAt).toLocaleDateString()}</td>
                      <td>{b.receivedQty} {defaultUnit}</td>
                      <td>{b.usedQty} {defaultUnit}</td>
                      {category === "PERISHABLE" ? <td>{b.wastedQty} {defaultUnit}</td> : null}
                      <td>{b.remainingQty} {defaultUnit}</td>
                      {category === "PERISHABLE" ? (
                        <td>
                          {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : "—"}
                          {expired && remaining > 0 ? (
                            <div className="fm-badge fm-badge-warn" style={{ marginTop: 2 }}>
                              ⚠ expired, log the leftover
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                      <td>
                        {remaining > 0 ? (
                          <BatchLogForm
                            rawMaterialId={rawMaterialId}
                            batchId={b.id}
                            defaultUnit={defaultUnit}
                            allowWaste={category === "PERISHABLE"}
                          />
                        ) : (
                          <span className="fm-li-meta">fully used</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <form onSubmit={handleReceive} style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ width: 110 }}>
              Receive qty
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                style={{ display: "block", width: "100%", padding: 5 }}
              />
            </label>
            {category === "PERISHABLE" ? (
              <label style={{ width: 150 }}>
                Expiry (optional)
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  style={{ display: "block", width: "100%", padding: 5 }}
                />
              </label>
            ) : null}
            <button type="submit" disabled={submitting} style={{ fontSize: ".82rem" }}>
              {submitting ? "Recording…" : "Receive batch"}
            </button>
          </form>
          {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".8rem" }}>{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function BatchLogForm({
  rawMaterialId,
  batchId,
  defaultUnit,
  allowWaste,
}: {
  rawMaterialId: string;
  batchId: string;
  defaultUnit: string;
  allowWaste: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState<"USED" | "WASTED">("USED");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/raw-materials/${rawMaterialId}/batches/${batchId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, quantity }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not log that.");
        return;
      }
      setQuantity("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {allowWaste ? (
        <select value={type} onChange={(e) => setType(e.target.value as "USED" | "WASTED")} style={{ padding: 3 }}>
          <option value="USED">Used</option>
          <option value="WASTED">Wasted</option>
        </select>
      ) : (
        <input type="hidden" value="USED" />
      )}
      <input
        type="number"
        step="0.01"
        min="0.01"
        placeholder={defaultUnit}
        required
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        style={{ width: 70, padding: 3 }}
      />
      <button type="submit" disabled={submitting} style={{ fontSize: ".78rem", padding: "3px 6px" }}>
        {submitting ? "…" : "Log"}
      </button>
      {error ? <span style={{ color: "#b00020", fontSize: ".75rem" }}>{error}</span> : null}
    </form>
  );
}
