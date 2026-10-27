"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AssignForm({
  projectId,
  candidates,
}: {
  projectId: string;
  candidates: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add them to the project.");
        return;
      }
      setUserId("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  if (candidates.length === 0) return null;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 420 }}>
      <select value={userId} onChange={(e) => setUserId(e.target.value)} required style={{ flex: 1, padding: 6 }}>
        <option value="" disabled>Add someone to this project…</option>
        {candidates.map((c) => (
          <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
        ))}
      </select>
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </form>
  );
}
