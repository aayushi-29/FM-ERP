"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResolveRequestForm({ id }: { id: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve(status: "FULFILLED" | "DECLINED") {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/data-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update this request.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
      <input
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ minWidth: 200 }}
      />
      <button type="button" disabled={submitting} onClick={() => resolve("FULFILLED")}>
        Mark fulfilled
      </button>
      <button type="button" className="fm-btn-ghost" disabled={submitting} onClick={() => resolve("DECLINED")}>
        Decline
      </button>
      {error ? (
        <span role="alert" style={{ color: "#b42318", fontSize: ".85rem" }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
