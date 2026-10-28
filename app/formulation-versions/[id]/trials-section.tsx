"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type TrialAttachment = { id: string; document: { id: string; type: string } };

type Trial = {
  id: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETE";
  parameters: string | null;
  results: string | null;
  conductedById: string;
  conductedAt: string;
  attachments: TrialAttachment[];
};

type ProjectDocument = { id: string; type: string; createdAt: string };

export function TrialsSection({
  versionId,
  trials,
  canCreate,
  currentUserId,
  projectDocuments,
}: {
  versionId: string;
  trials: Trial[];
  canCreate: boolean; // NPD Executive / Admin
  currentUserId: string;
  projectDocuments: ProjectDocument[];
}) {
  const router = useRouter();
  const [parameters, setParameters] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [removingAttachmentId, setRemovingAttachmentId] = useState<string | null>(null);
  const [selectedDocByTrial, setSelectedDocByTrial] = useState<Record<string, string>>({});

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

  async function attachDocument(trial: Trial) {
    const documentId = selectedDocByTrial[trial.id];
    if (!documentId) return;
    setAttachingId(trial.id);
    setError(null);
    try {
      const res = await fetch(`/api/trials/${trial.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not attach that document.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setAttachingId(null);
    }
  }

  async function removeAttachment(attachmentId: string) {
    setRemovingAttachmentId(attachmentId);
    setError(null);
    try {
      const res = await fetch(`/api/trial-attachments/${attachmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not remove that attachment.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setRemovingAttachmentId(null);
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

              {t.attachments.length > 0 ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: ".85rem" }}>
                  {t.attachments.map((a) => (
                    <li key={a.id}>
                      {a.document.type}
                      {canCreate ? (
                        <button
                          onClick={() => removeAttachment(a.id)}
                          disabled={removingAttachmentId === a.id}
                          style={{ marginLeft: 8, fontSize: ".78rem", padding: "1px 6px" }}
                        >
                          {removingAttachmentId === a.id ? "…" : "Remove"}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {canCreate && t.conductedById === currentUserId ? (
                <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
                  <select
                    value={selectedDocByTrial[t.id] ?? ""}
                    onChange={(e) => setSelectedDocByTrial((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    style={{ fontSize: ".82rem", padding: "2px 4px" }}
                  >
                    <option value="">Attach a document…</option>
                    {projectDocuments
                      .filter((d) => !t.attachments.some((a) => a.document.id === d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.type}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => attachDocument(t)}
                    disabled={attachingId === t.id || !selectedDocByTrial[t.id]}
                    style={{ fontSize: ".82rem", padding: "2px 8px" }}
                  >
                    {attachingId === t.id ? "…" : "Attach"}
                  </button>
                </div>
              ) : null}

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
