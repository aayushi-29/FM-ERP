"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export function VersionActions({
  versionId,
  status,
  canEdit,
  canDecide,
  canRevise,
  openRevisionRequestId,
}: {
  versionId: string;
  status: Status;
  canEdit: boolean; // DRAFT owner (NPD Executive / Admin) — submit for review
  canDecide: boolean; // Project Lead / Admin — approve or reject
  canRevise: boolean; // NPD Executive / Admin, latest APPROVED/REJECTED version
  openRevisionRequestId?: string | null; // if set, "Revise" marks this rework request ADDRESSED
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, body?: object) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "That action didn't go through.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  async function submitForReview() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/formulation-versions/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not submit for review.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  async function revise() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/formulation-versions/${versionId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(openRevisionRequestId ? { addressesRequestId: openRevisionRequestId } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create a revision.");
        return;
      }
      if (data.version?.id) {
        router.push(`/formulation-versions/${data.version.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}

      {canEdit && status === "DRAFT" ? (
        <button disabled={pending} onClick={submitForReview}>
          {pending ? "Submitting…" : "Submit for review"}
        </button>
      ) : null}

      {canDecide && status === "IN_REVIEW" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ flex: 1, minWidth: 200 }}>
            Comment (optional)
            <input value={comment} onChange={(e) => setComment(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }} />
          </label>
          <button
            disabled={pending}
            onClick={() => call(`/api/formulation-versions/${versionId}/approve`, { decision: "APPROVED", comment: comment || undefined })}
          >
            Approve
          </button>
          <button
            disabled={pending}
            onClick={() => call(`/api/formulation-versions/${versionId}/approve`, { decision: "REJECTED", comment: comment || undefined })}
          >
            Reject
          </button>
        </div>
      ) : null}

      {canRevise && (status === "APPROVED" || status === "REJECTED") ? (
        <button disabled={pending} onClick={revise}>
          {pending
            ? "Creating revision…"
            : openRevisionRequestId
            ? "Revise (addresses the open rework request)"
            : "Revise (create next draft)"}
        </button>
      ) : null}
    </div>
  );
}
