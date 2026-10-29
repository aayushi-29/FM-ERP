"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// 29 Oct 2026 (second pass): Client-facing payment claim. Submitting this
// does NOT mark the invoice paid or create a Payment — it's only a claim
// for Admin to verify (see docs/decisions.md).
export function ClaimPaymentForm({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [acknowledgementOrInvoiceNumber, setAcknowledgementOrInvoiceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payment-claims`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, bankAccountNumber, paymentMode, acknowledgementOrInvoiceNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not submit your payment claim.");
        return;
      }
      setAmount("");
      setBankAccountNumber("");
      setPaymentMode("");
      setAcknowledgementOrInvoiceNumber("");
      setSubmitted(true);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ marginTop: 20, padding: 14, background: "#f7f7f7", borderRadius: 8 }}>
      <h2 style={{ fontSize: "1.05rem", marginTop: 0 }}>Tell us you&apos;ve paid</h2>
      <p style={{ color: "#555", fontSize: ".85rem" }}>
        Already paid this invoice? Let us know the details below and we&apos;ll confirm it. This
        doesn&apos;t mark the invoice as paid by itself &mdash; our team checks it first.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ width: 120 }}>
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required style={{ display: "block", width: "100%", padding: 6 }} />
        </label>
        <label style={{ width: 170 }}>
          Your bank account no.
          <input value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
        </label>
        <label style={{ width: 150 }}>
          Mode of payment
          <input value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} placeholder="e.g. NEFT, UPI" required style={{ display: "block", width: "100%", padding: 6 }} />
        </label>
        <label style={{ flex: 1, minWidth: 180 }}>
          Acknowledgement / reference no.
          <input
            value={acknowledgementOrInvoiceNumber}
            onChange={(e) => setAcknowledgementOrInvoiceNumber(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: 6 }}
          />
        </label>
        <button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</button>
      </form>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
      {submitted ? <p style={{ color: "#2a7a2a", fontSize: ".85rem" }}>Thanks — we&apos;ll confirm this shortly.</p> : null}
    </div>
  );
}
