"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserActions({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggleActive() {
    setPending(true);
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

  return (
    <button onClick={toggleActive} disabled={pending} style={{ fontSize: ".82rem", padding: "4px 10px" }}>
      {pending ? "…" : active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
