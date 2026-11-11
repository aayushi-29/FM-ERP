"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserActions({
  id,
  active,
  canDelete,
}: {
  id: string;
  active: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function deleteUser() {
    if (
      !confirm(
        "Permanently delete this user? This cannot be undone. If they have related records (projects, invoices, approvals), the delete will be blocked — deactivate them instead in that case."
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to delete user");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={toggleActive} disabled={pending} style={{ fontSize: ".82rem", padding: "4px 10px" }}>
          {pending ? "…" : active ? "Deactivate" : "Reactivate"}
        </button>
        {canDelete && (
          <button
            onClick={deleteUser}
            disabled={pending}
            style={{ fontSize: ".82rem", padding: "4px 10px", color: "#b00020", borderColor: "#b00020" }}
          >
            {pending ? "…" : "Delete"}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: ".78rem", color: "#b00020" }}>{error}</span>}
    </div>
  );
}
