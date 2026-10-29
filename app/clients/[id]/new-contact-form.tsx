"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewContactForm({ clientOrgId }: { clientOrgId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clients/${clientOrgId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email || undefined,
          phone: phone || undefined,
          isPrimary,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the contact.");
        return;
      }
      setName("");
      setEmail("");
      setPhone("");
      setIsPrimary(false);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required style={{ padding: 6 }} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email" style={{ padding: 6 }} />
      <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" style={{ padding: 6 }} />
      <label style={{ fontSize: ".85rem", display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} /> Primary contact
      </label>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add contact"}</button>
    </form>
  );
}
