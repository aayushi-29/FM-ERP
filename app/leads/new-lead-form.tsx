"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewLeadForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // 29 Oct 2026 (fourth pass): "in leads there should be a place to add
  // description about the lead to understand in future" — confirmed the
  // backend already accepts `notes` on creation (app/api/leads/route.ts's
  // zod schema), so this is purely a new field on the existing form.
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          contactName,
          email: email || undefined,
          phone: phone || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not add the lead.");
        return;
      }
      setCompanyName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setNotes("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", maxWidth: 640 }}>
      <input
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Company name"
        required
        style={{ padding: 6, flex: "1 1 180px" }}
      />
      <input
        value={contactName}
        onChange={(e) => setContactName(e.target.value)}
        placeholder="Contact name"
        required
        style={{ padding: 6, flex: "1 1 160px" }}
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        type="email"
        style={{ padding: 6, flex: "1 1 160px" }}
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone (optional)"
        style={{ padding: 6, flex: "1 1 140px" }}
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Description / notes about this lead (optional)"
        rows={2}
        style={{ padding: 6, flex: "1 1 100%", resize: "vertical", fontFamily: "inherit" }}
      />
      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add lead"}
      </button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem", width: "100%" }}>{error}</p> : null}
    </form>
  );
}
