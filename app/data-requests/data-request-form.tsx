"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function DataRequestForm() {
  const router = useRouter();
  const [type, setType] = useState<"EXPORT" | "DELETE">("EXPORT");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/data-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not submit your request. Please try again.");
        return;
      }
      setDone(true);
      setNote("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="fm-login-form">
      <label>
        Request type
        <select value={type} onChange={(e) => setType(e.target.value as "EXPORT" | "DELETE")}>
          <option value="EXPORT">Send me a copy of my data</option>
          <option value="DELETE">Delete my account and data</option>
        </select>
      </label>
      <label>
        Anything else we should know? (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
      </label>
      {error ? (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      ) : null}
      {done ? <p style={{ color: "#1a7f37" }}>Request submitted. An administrator will follow up with you.</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit request"}
      </button>
    </form>
  );
}
