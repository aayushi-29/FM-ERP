"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type RevisionRequest = {
  id: string;
  notes: string;
  status: "OPEN" | "ADDRESSED";
  createdAt: string;
  addressedAt: string | null;
  requestedBy: { id: string; name: string };
};

// "After approval add rework section when client changes their
// requirements" — this renders on an APPROVED version. A CLIENT sees a
// form to file a new request (only while none is OPEN); every role with
// project access sees the list, so internal roles know a rework was asked
// for even before they open the Revise flow.
export function RevisionRequestsSection({
  versionId,
  revisionRequests,
  canFile,
}: {
  versionId: string;
  revisionRequests: RevisionRequest[];
  canFile: boolean; // CLIENT only, and only the page decides whether status===APPROVED
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hasOpenRequest = revisionRequests.some((r) => r.status === "OPEN");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/formulation-versions/${versionId}/revision-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not file the rework request.");
        return;
      }
      setNotes("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {revisionRequests.length === 0 ? (
        <p style={{ color: "#777" }}>No rework requests on this version.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {revisionRequests.map((r) => (
            <li key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid #eee", fontSize: ".9rem" }}>
              <span className="fm-badge" style={{ fontSize: ".72rem" }}>{r.status}</span>
              <span style={{ color: "#777", marginLeft: 6 }}>
                by {r.requestedBy.name} · {new Date(r.createdAt).toLocaleDateString()}
                {r.addressedAt ? ` · addressed ${new Date(r.addressedAt).toLocaleDateString()}` : ""}
              </span>
              <p style={{ margin: "4px 0 0" }}>{r.notes}</p>
            </li>
          ))}
        </ul>
      )}

      {canFile && !hasOpenRequest ? (
        <form onSubmit={handleSubmit} style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxWidth: 480 }}>
          <label>
            Request a change
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What would you like changed about this formulation?"
              rows={3}
              required
              style={{ display: "block", width: "100%", padding: 6 }}
            />
          </label>
          <button type="submit" disabled={submitting} style={{ alignSelf: "flex-start" }}>
            {submitting ? "Sending…" : "Send request"}
          </button>
          {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
        </form>
      ) : null}
      {canFile && hasOpenRequest ? (
        <p style={{ color: "#777", fontSize: ".85rem", marginTop: 8 }}>
          You already have an open rework request on this version.
        </p>
      ) : null}
    </div>
  );
}
