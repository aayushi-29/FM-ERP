"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function AcceptPoliciesForm() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!checked) {
      setError("Please check the box to confirm you've read both documents.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/accept-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not record your acceptance. Please try again.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="fm-login-form">
      <label style={{ display: "flex", alignItems: "flex-start", gap: ".5rem", fontWeight: 400 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          style={{ marginTop: ".2rem" }}
        />
        <span>
          I have read and agree to the{" "}
          <a href="/legal/privacy" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/legal/terms" target="_blank" rel="noreferrer">
            Terms of Service
          </a>
          .
        </span>
      </label>
      {error ? (
        <p role="alert" style={{ color: "#b42318" }}>
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
