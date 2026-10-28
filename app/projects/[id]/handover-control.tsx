"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Remaining 15% before handling the final product" — this is the handover
// action itself (Admin-only, PATCHes Project.status to COMPLETED). The
// server (app/api/projects/[id]/route.ts, lib/payments/stage-gates.ts)
// rejects it until the FINAL_15 invoice's Payment is verified — this
// button doesn't pre-check that; it just surfaces whatever the server says.
export function HandoverControl({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markHandedOver() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not mark this project as handed over.");
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
    <div style={{ marginTop: 10 }}>
      <button disabled={pending} onClick={markHandedOver}>
        {pending ? "Marking…" : "Mark final product as handed over"}
      </button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </div>
  );
}
