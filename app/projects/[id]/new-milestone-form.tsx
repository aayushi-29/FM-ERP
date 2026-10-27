"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewMilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dueDate: dueDate ? new Date(dueDate).toISOString() : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the milestone.");
        return;
      }
      setTitle("");
      setDueDate("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", maxWidth: 480 }}>
      <label style={{ flex: 1, minWidth: 160 }}>
        Milestone title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label>
        Due date
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ display: "block", padding: 6 }} />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add milestone"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem", width: "100%" }}>{error}</p> : null}
    </form>
  );
}
