"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewTaskForm({
  projectId,
  assignees,
}: {
  projectId: string;
  assignees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          assigneeId: assigneeId || undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the task.");
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
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", maxWidth: 520 }}>
      <label style={{ flex: 1, minWidth: 160 }}>
        Task title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label>
        Assignee
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={{ display: "block", padding: 6 }}>
          <option value="">Unassigned</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <label>
        Due date
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ display: "block", padding: 6 }} />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add task"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem", width: "100%" }}>{error}</p> : null}
    </form>
  );
}
