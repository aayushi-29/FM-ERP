"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Trial = {
  id: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETE";
  parameters: string | null;
  results: string | null;
  conductedById: string;
  conductedAt: string;
};

export function TrialsSection({
  versionId,
  trials,
  canCreate,
  currentUserId,
}: {
  versionId: string;
  trials: Trial[];
  canCreate: boolean; // NPD Executive / Admin
  currentUserId: string;
}) {
  const router = useRouter();
  const [parameters, setParameters] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/formulation-versions/${versionId}/trials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parameters: parameters || undefined, status: "PLANNED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not log the trial.");
        return;
      }
      setParameters("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateStatus(trial: Trial, status: Trial["status"]) {
    setUpdatingId(trial.id);
    setError(null);
    try {
      const res = await fetch(`/api/trials/${trial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update that trial.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}

      {trials.length === 0 ? (
        <p style={{ color: "#777" }}>No trials logged yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {trials.map((t) => (
            <li key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee" }}>
              <span style={{ fontWeight: 600 }}>{t.status}</span>
              <span style={{ color: "#777", fontSize: ".85rem" }}>
                {" · logged "}{new Date(t.conductedAt).toLocaleDateString()}
              </span>
              {t.parameters ? <p style={{ margin: "4px 0 0", fontSize: ".9rem" }}>{t.parameters}</p> : null}
              {t.results ? <p style={{ margin: "2px 0 0", fontSize: ".9rem", color: "#555" }}>Results: {t.results}</p> : null}

              {canCreate && t.conductedById === currentUserId && t.status !== "COMPLETE" ? (
                <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                  {t.status === "PLANNED" ? (
                    <button disabled={updatingId === t.id} onClick={() => updateStatus(t, "IN_PROGRESS")}>Start</button>
                  ) : null}
                  <button disabled={updatingId === t.id} onClick={() => updateStatus(t, "COMPLETE")}>Mark complete</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            Trial parameters
            <input value={parameters} onChange={(e) => setParameters(e.target.value)} placeholder="e.g. Batch of 2kg, 180°C bake" style={{ display: "block", width: "100%", padding: 6 }} />
          </label>
          <button type="submit" disabled={submitting}>{submitting ? "Logging…" : "Log trial"}</button>
        </form>
      ) : null}
    </div>
  );
}
