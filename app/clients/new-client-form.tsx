"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not create the client organization.");
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 420 }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Client organization name"
        required
        style={{ flex: 1, padding: 6 }}
      />
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </form>
  );
}
