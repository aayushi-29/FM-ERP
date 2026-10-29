"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026 (second pass): Admin-only acknowledge/reject on a PENDING
// payment claim. Acknowledge creates the real, verified Payment; reject
// just records a reason, visible to the Client.
export function PendingClaimActions({ claimId }: { claimId: string }) {
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
    <div style={{ marginTop: 6 }}>
      <button disabled={pending} onClick={() => call(`/api/payment-claims/${claimId}/acknowledge`)} style={{ fontSize: ".8rem", marginRight: 6 }}>
        Acknowledge
      </button>
      {!showReject ? (
        <button disabled={pending} onClick={() => setShowReject(true)} style={{ fontSize: ".8rem" }}>
          Reject
        </button>
      ) : (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason"
            style={{ padding: 4, fontSize: ".82rem" }}
          />
          <button
            disabled={pending || !reason}
            onClick={async () => {
              await call(`/api/payment-claims/${claimId}/reject`, { reason });
              setReason("");
              setShowReject(false);
            }}
            style={{ fontSize: ".8rem" }}
          >
            Confirm reject
          </button>
        </span>
      )}
      {error ? <span style={{ color: "#b00020", fontSize: ".78rem", marginLeft: 6 }}>{error}</span> : null}
    </div>
  );
}
