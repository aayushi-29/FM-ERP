"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeleteBlockerItem = { label: string; href?: string };
type DeleteBlockerGroup = { label: string; count: number; items: DeleteBlockerItem[] };

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
  const [blockers, setBlockers] = useState<DeleteBlockerGroup[] | null>(null);

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
        "Permanently delete this user? This cannot be undone. If they have related records (projects, invoices, approvals), the delete will be blocked and you'll see exactly what's still linked to them."
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    setBlockers(null);
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to delete user");
        setBlockers(Array.isArray(body.blockers) ? body.blockers : null);
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

      {error && (
        <span style={{ fontSize: ".78rem", color: "#b00020", maxWidth: 320 }}>{error}</span>
      )}

      {blockers && blockers.length > 0 && (
        <div
          style={{
            fontSize: ".76rem",
            maxWidth: 320,
            border: "1px solid rgba(176,0,32,0.3)",
            borderRadius: 6,
            padding: "6px 8px",
            marginTop: 2,
          }}
        >
          {blockers.map((group) => (
            <div key={group.label} style={{ marginBottom: 4 }}>
              <strong>
                {group.label} ({group.count})
              </strong>
              <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
                {group.items.map((item, i) =>
                  item.href ? (
                    <li key={i}>
                      <a href={item.href} target="_blank" rel="noopener noreferrer">
                        {item.label}
                      </a>
                    </li>
                  ) : (
                    <li key={i}>{item.label}</li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
