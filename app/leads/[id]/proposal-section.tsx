"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export interface ProposalRow {
  id: string;
  versionNumber: number;
  status: "DRAFT" | "INTERNAL_REVIEW" | "SENT" | "REVISION_REQUESTED" | "ACCEPTED";
  title: string;
  content: string;
  reviewNotes: string | null;
  clientDecisionNotes: string | null;
  sentAt: string | null;
  decidedAt: string | null;
  preparedBy: { id: string; name: string };
  reviewedBy: { id: string; name: string } | null;
}

const STATUS_LABEL: Record<ProposalRow["status"], string> = {
  DRAFT: "Draft",
  INTERNAL_REVIEW: "Internal review",
  SENT: "Sent to client",
  REVISION_REQUESTED: "Revision requested",
  ACCEPTED: "Accepted",
};

// "Create Proposal → Internal Review → Approval → Send to Client, with a
// revision loop back to Create Proposal" — this component renders the
// whole history (newest version first) and, for the single open/latest
// version, whichever action moves it to the next status. There is no
// Client user account at the lead stage, so "Accepted"/"Revision
// requested" are recorded by an Admin/Project Lead after an offline
// conversation (see app/api/proposals/[id]/decision/route.ts's comment).
export function ProposalSection({ leadId, proposals }: { leadId: string; proposals: ProposalRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const hasOpenProposal = proposals.some((p) =>
    ["DRAFT", "INTERNAL_REVIEW", "SENT"].includes(p.status)
  );
  const hasAccepted = proposals.some((p) => p.status === "ACCEPTED");

  async function createProposal(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the proposal.");
        return;
      }
      setTitle("");
      setContent("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setCreating(false);
    }
  }

  async function act(proposalId: string, path: string, body?: Record<string, unknown>) {
    setError(null);
    setBusyId(proposalId);
    try {
      const res = await fetch(`/api/proposals/${proposalId}${path}`, {
        method: path ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That action failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  async function patchAction(proposalId: string, body: Record<string, unknown>) {
    setError(null);
    setBusyId(proposalId);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "That action failed.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      {hasAccepted ? (
        <p style={{ color: "#2a7a2a", fontSize: ".85rem" }}>✓ An accepted proposal exists — this lead can be converted.</p>
      ) : (
        <p style={{ color: "#b00020", fontSize: ".85rem" }}>
          This lead can&apos;t be converted until a proposal is sent and the client&apos;s acceptance is recorded.
        </p>
      )}

      {error ? <p style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}

      {proposals.length === 0 ? (
        <p style={{ color: "#777", fontSize: ".9rem" }}>No proposals yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {proposals.map((p) => (
            <li key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <p style={{ margin: 0 }}>
                <strong>v{p.versionNumber} — {p.title}</strong>{" "}
                <span style={{ color: "#777", fontSize: ".85rem" }}>· {STATUS_LABEL[p.status]}</span>
              </p>
              <p style={{ whiteSpace: "pre-wrap", color: "#555", fontSize: ".9rem" }}>{p.content}</p>
              {p.reviewNotes ? (
                <p style={{ fontSize: ".85rem", color: "#555" }}>Review notes: {p.reviewNotes}</p>
              ) : null}
              {p.clientDecisionNotes ? (
                <p style={{ fontSize: ".85rem", color: "#555" }}>Client said: {p.clientDecisionNotes}</p>
              ) : null}

              {p.status === "DRAFT" ? (
                <button
                  disabled={busyId === p.id}
                  onClick={() => patchAction(p.id, { action: "submit_for_review" })}
                  style={{ marginTop: 6 }}
                >
                  Submit for internal review
                </button>
              ) : null}

              {p.status === "INTERNAL_REVIEW" ? (
                <button disabled={busyId === p.id} onClick={() => act(p.id, "/approve")} style={{ marginTop: 6 }}>
                  Approve &amp; send to client
                </button>
              ) : null}

              {p.status === "SENT" ? (
                <ClientDecisionForm proposalId={p.id} busy={busyId === p.id} onAct={act} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {!hasOpenProposal ? (
        <form onSubmit={createProposal} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 480, marginTop: 12 }}>
          <h3 style={{ fontSize: ".95rem", margin: 0 }}>New proposal</h3>
          <label style={{ fontSize: ".85rem" }}>
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
            />
          </label>
          <label style={{ fontSize: ".85rem" }}>
            Content
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={5}
              style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
            />
          </label>
          <button type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create draft proposal"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function ClientDecisionForm({
  proposalId,
  busy,
  onAct,
}: {
  proposalId: string;
  busy: boolean;
  onAct: (id: string, path: string, body?: Record<string, unknown>) => Promise<void>;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, maxWidth: 420 }}>
      <label style={{ fontSize: ".8rem" }}>
        Record the client&apos;s response (notes optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
        />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          disabled={busy}
          onClick={() => onAct(proposalId, "/decision", { decision: "ACCEPTED", clientDecisionNotes: notes || undefined })}
        >
          Client accepted
        </button>
        <button
          disabled={busy}
          onClick={() =>
            onAct(proposalId, "/decision", { decision: "REVISION_REQUESTED", clientDecisionNotes: notes || undefined })
          }
        >
          Client requested changes
        </button>
      </div>
    </div>
  );
}
