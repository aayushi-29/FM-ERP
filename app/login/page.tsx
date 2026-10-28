"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not sign in. Please try again.");
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
    <main className="fm-login">
      <div className="fm-login-card glass glass-strong glass-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Food Monk Innovations" width={56} height={56} className="fm-login-logo" />
        <h1>Sign in</h1>
        <p className="fm-muted fm-login-sub">Welcome back to Food Monk ERP.</p>

        <form onSubmit={handleSubmit} className="fm-login-form">
          <label htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" className="fm-login-error">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={submitting} className="fm-login-submit">
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="fm-muted fm-login-footnote">
          Account access is created by your Admin. Contact them if you don&apos;t have a login yet.
        </p>
      </div>
    </main>
  );
}
