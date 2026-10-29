"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export function InvoiceActions({
  invoiceId,
  status,
  payments,
}: {
  invoiceId: string;
  status: Status;
  payments: { id: string; verified: boolean }[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");

  async function call(url: string, body?: object, method: "POST" | "PATCH" = "POST") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "That action didn't go through.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}

      <div style={{ display: "flex", gap: 8 }}>
        {status === "DRAFT" ? (
          <button disabled={pending} onClick={() => call(`/api/invoices/${invoiceId}`, { action: "SEND" }, "PATCH")}>
            Send invoice
          </button>
        ) : null}
        {status !== "PAID" && status !== "CANCELLED" ? (
          <button disabled={pending} onClick={() => call(`/api/invoices/${invoiceId}`, { action: "CANCEL" }, "PATCH")}>
            Cancel invoice
          </button>
        ) : null}
      </div>

      {status !== "DRAFT" && status !== "CANCELLED" ? (
        <div>
          <h3 style={{ fontSize: ".95rem" }}>Record a payment</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>
              Amount
              <input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" style={{ display: "block", padding: 6, width: 110 }} />
            </label>
            <label>
              Method
              <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Bank transfer" style={{ display: "block", padding: 6 }} />
            </label>
            <label>
              Reference
              <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} style={{ display: "block", padding: 6 }} />
            </label>
            <button
              disabled={pending || !paymentAmount}
              onClick={async () => {
                await call(`/api/invoices/${invoiceId}/payments`, {
                  amount: paymentAmount,
                  method: paymentMethod || undefined,
                  reference: paymentReference || undefined,
                });
                setPaymentAmount("");
                setPaymentMethod("");
                setPaymentReference("");
              }}
            >
              Record payment
            </button>
          </div>

          {payments.some((p) => !p.verified) ? (
            <div style={{ marginTop: 6 }}>
              {payments.filter((p) => !p.verified).map((p) => (
                <button key={p.id} disabled={pending} onClick={() => call(`/api/payments/${p.id}/verify`)} style={{ fontSize: ".82rem", marginRight: 6 }}>
                  Verify payment {p.id.slice(-6)}
                </button>
              ))}
            </div>
          ) : null}

          <h3 style={{ fontSize: ".95rem", marginTop: 16 }}>Reduce invoice amount (credit note)</h3>
          <p style={{ color: "#777", fontSize: ".82rem", margin: "0 0 8px" }}>
            Lowers the amount owed on this invoice — for a billing correction or discount. It does
            not refund cash and does not touch bank or payment records.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label>
              Amount
              <input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="0.00" style={{ display: "block", padding: 6, width: 110 }} />
            </label>
            <label style={{ flex: 1, minWidth: 180 }}>
              Reason
              <input value={creditReason} onChange={(e) => setCreditReason(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }} />
            </label>
            <button
              disabled={pending || !creditAmount || !creditReason}
              onClick={async () => {
                await call(`/api/invoices/${invoiceId}/credit-notes`, { amount: creditAmount, reason: creditReason });
                setCreditAmount("");
                setCreditReason("");
              }}
            >
              Reduce invoice amount
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
