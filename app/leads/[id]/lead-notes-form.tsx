"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026 (fourth pass): "in leads there should be a place to add
// description about the lead to understand in future" — confirmed with the
// user's words; PATCH /api/leads/[id] already accepts `notes` (zod schema
// in app/api/leads/[id]/route.ts), so no backend change was needed, only
// this edit UI. Mirrors LeadStatusActions' pattern (local state, PATCH,
// router.refresh()) rather than introducing a new convention.
export function LeadNotesForm({ id, notes }: { id: string; notes: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save the note.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div style={{ marginTop: 8 }}>
        {notes ? (
          <p style={{ color: "#555", whiteSpace: "pre-wrap" }}>{notes}</p>
        ) : (
          <p className="fm-empty">No description yet.</p>
        )}
        <button
          type="button"
          onClick={() => {
            setValue(notes ?? "");
            setEditing(true);
          }}
          style={{ padding: "4px 10px", fontSize: ".85rem" }}
        >
          {notes ? "Edit description" : "Add description"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6, maxWidth: 640 }}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Add context about this lead for future reference…"
        style={{ padding: 8, resize: "vertical", fontFamily: "inherit" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={save} disabled={saving} style={{ padding: "4px 10px", fontSize: ".85rem" }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(notes ?? "");
          }}
          disabled={saving}
          style={{ padding: "4px 10px", fontSize: ".85rem" }}
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
