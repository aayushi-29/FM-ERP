"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LeadStatusActions({ id, status }: { id: string; status: "OPEN" | "QUALIFIED" | "LOST" }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function setStatus(next: "OPEN" | "QUALIFIED" | "LOST") {
    setPending(next);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {(["OPEN", "QUALIFIED", "LOST"] as const)
        .filter((s) => s !== status)
        .map((s) => (
          <button key={s} onClick={() => setStatus(s)} disabled={pending !== null} style={{ padding: "4px 10px", fontSize: ".85rem" }}>
            {pending === s ? "…" : `Mark ${s}`}
          </button>
        ))}
    </div>
  );
}
