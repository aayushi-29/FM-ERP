"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026 (fourth pass): Project Lead/Admin approve or reject a raw
// material an NPD Executive submitted — mirrors app/invoices/[id]
// /pending-claim-actions.tsx's acknowledge/reject shape. Approve is a
// single click (there's nothing to confirm); Reject reveals an optional
// reason field first, same as a payment-claim rejection.
export function MaterialApprovalActions({
  materialId,
  status,
}: {
  materialId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  return (
    <div style={{ marginTop: 8 }}>
      {status !== "APPROVED" ? (
        <button
          disabled={pending}
          onClick={() => call(`/api/raw-materials/${materialId}/approve`)}
          className="fm-badge fm-badge-good"
          style={{ marginRight: 6, border: "none", cursor: "pointer" }}
        >
          {pending ? "…" : "Approve"}
        </button>
      ) : null}

      {status !== "REJECTED" ? (
        !showReject ? (
          <button
            disabled={pending}
            onClick={() => setShowReject(true)}
            className="fm-badge fm-badge-warn"
            style={{ border: "none", cursor: "pointer" }}
          >
            Reject
          </button>
        ) : (
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              style={{ padding: 4, fontSize: ".82rem" }}
            />
            <button
              disabled={pending}
              onClick={async () => {
                await call(`/api/raw-materials/${materialId}/reject`, { reason: reason || undefined });
                setReason("");
                setShowReject(false);
              }}
              style={{ fontSize: ".8rem" }}
            >
              Confirm reject
            </button>
          </span>
        )
      ) : null}

      {error ? <div style={{ color: "#b00020", fontSize: ".78rem", marginTop: 4 }}>{error}</div> : null}
    </div>
  );
}
