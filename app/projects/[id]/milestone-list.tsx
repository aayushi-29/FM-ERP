"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Milestone = {
  id: string;
  title: string;
  status: "PENDING" | "SUBMITTED" | "APPROVED" | "REJECTED";
  dueDate: string | null;
};

export function MilestoneList({
  milestones,
  role,
  executionUnlocked = true,
}: {
  milestones: Milestone[];
  role: "ADMIN" | "PROJECT_LEAD" | "NPD_EXECUTIVE" | "CLIENT";
  // 29 Oct 2026 (third pass): milestones now join execution-gate.ts's
  // lock, so a Project Lead can't request approval and a Client can't
  // decide one until the 60% advance is verified — the server enforces
  // this (app/api/milestones/[id]/route.ts), this just keeps the buttons
  // from being shown only to fail. Defaults true so existing callers that
  // don't pass it (none currently) aren't silently broken.
  executionUnlocked?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(id: string, body: object) {
    setPendingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/milestones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not update that milestone.");
      }
    } finally {
      setPendingId(null);
    }
  }

  if (milestones.length === 0) return <p style={{ color: "#777" }}>No milestones yet.</p>;

  return (
    <>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {milestones.map((m) => (
          <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #eee" }}>
            <span style={{ flex: 1 }}>
              {m.title}
              <span style={{ color: "#777", fontSize: ".82rem" }}>
                {" · "}
                {m.status}
                {m.dueDate ? ` · due ${new Date(m.dueDate).toLocaleDateString()}` : ""}
              </span>
            </span>

            {role === "PROJECT_LEAD" && m.status === "PENDING" && executionUnlocked ? (
              <button disabled={pendingId === m.id} onClick={() => patch(m.id, { requestApproval: true })}>
                Request approval
              </button>
            ) : null}

            {role === "CLIENT" && m.status === "SUBMITTED" && executionUnlocked ? (
              <>
                <button disabled={pendingId === m.id} onClick={() => patch(m.id, { decision: "APPROVED" })}>
                  Approve
                </button>
                <button disabled={pendingId === m.id} onClick={() => patch(m.id, { decision: "REJECTED" })}>
                  Reject
                </button>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
