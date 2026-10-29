"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026 (second pass): contactPersonName/contactPhone replace the
// single free-text "contact" field — see docs/decisions.md.
export function NewSupplierForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
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
        body: JSON.stringify({
          name,
          contactPersonName: contactPersonName || undefined,
          contactPhone: contactPhone || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the supplier.");
        return;
      }
      setName("");
      setContactPersonName("");
      setContactPhone("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, maxWidth: 600, flexWrap: "wrap" }}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Supplier (company) name"
        required
        style={{ flex: 1, minWidth: 160, padding: 6 }}
      />
      <input
        value={contactPersonName}
        onChange={(e) => setContactPersonName(e.target.value)}
        placeholder="Contact person's name (optional)"
        style={{ flex: 1, minWidth: 160, padding: 6 }}
      />
      <input
        value={contactPhone}
        onChange={(e) => setContactPhone(e.target.value)}
        placeholder="Contact phone (optional)"
        style={{ flex: 1, minWidth: 160, padding: 6 }}
      />
      <button type="submit" disabled={submitting}>{submitting ? "Adding…" : "Add supplier"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </form>
  );
}
