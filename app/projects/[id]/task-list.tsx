"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
  assignee: { id: string; name: string } | null;
  dueDate: string | null;
};

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export function TaskList({ tasks }: { tasks: Task[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update that task.");
      }
    } finally {
      setPendingId(null);
    }
  }

  if (tasks.length === 0) return <p style={{ color: "#777" }}>No tasks yet.</p>;

  return (
    <>
    {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    <ul style={{ listStyle: "none", padding: 0 }}>
      {tasks.map((t) => (
        <li key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #eee" }}>
          <span style={{ flex: 1 }}>
            {t.title}
            <span style={{ color: "#777", fontSize: ".82rem" }}>
              {t.assignee ? ` · ${t.assignee.name}` : " · unassigned"}
              {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ""}
            </span>
          </span>
          <select
            value={t.status}
            disabled={pendingId === t.id}
            onChange={(e) => updateStatus(t.id, e.target.value)}
            style={{ fontSize: ".82rem" }}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </li>
      ))}
    </ul>
    </>
  );
}
