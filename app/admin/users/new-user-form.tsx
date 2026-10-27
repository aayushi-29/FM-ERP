"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const ROLES = ["ADMIN", "PROJECT_LEAD", "NPD_EXECUTIVE", "CLIENT"] as const;

export function NewUserForm({ clientOrgs }: { clientOrgs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("PROJECT_LEAD");
  const [clientOrgId, setClientOrgId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          role,
          password,
          clientOrgId: role === "CLIENT" ? clientOrgId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not create the user.");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label>
        Role
        <select value={role} onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])} style={{ display: "block", width: "100%", padding: 6 }}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </label>
      {role === "CLIENT" ? (
        <label>
          Client organization
          <select value={clientOrgId} onChange={(e) => setClientOrgId(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }}>
            <option value="" disabled>Select one…</option>
            {clientOrgs.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Temporary password
        <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
      <button type="submit" disabled={submitting} style={{ padding: "8px 14px" }}>
        {submitting ? "Creating…" : "Create user"}
      </button>
      <p style={{ fontSize: ".78rem", color: "#666" }}>
        There&apos;s no invite email yet — share this password with them directly
        and ask them to treat it as temporary. A password-reset flow is a
        near-term follow-up, not built yet.
      </p>
    </form>
  );
}
