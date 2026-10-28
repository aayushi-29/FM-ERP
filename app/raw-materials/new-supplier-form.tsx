"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewSupplierForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, contact: contact || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the supplier.");
        return;
      }
      setName("");
      setContact("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 480, flexWrap: "wrap" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Supplier name"
        required
        style={{ flex: 1, minWidth: 160, padding: 6 }}
      />
      <input
        value={contact}
        onChange={(e) => setContact(e.target.value)}
        placeholder="Contact (phone/email, optional)"
        style={{ flex: 1, minWidth: 160, padding: 6 }}
      />
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add supplier"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </form>
  );
}
