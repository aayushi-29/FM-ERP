"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function NewProjectForm({
  clientOrgs,
  leads,
}: {
  clientOrgs: { id: string; name: string }[];
  leads: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [clientOrgId, setClientOrgId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [scope, setScope] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          clientOrgId,
          leadId,
          scope: scope || undefined,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not create the project.");
        return;
      }
      const data = await res.json();
      router.push(`/projects/${data.project.id}`);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420 }}>
      <label>
        Project name
        <input value={name} onChange={(e) => setName(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label>
        Client organization
        <select value={clientOrgId} onChange={(e) => setClientOrgId(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }}>
          <option value="" disabled>Select one…</option>
          {clientOrgs.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </label>
      <label>
        Project Lead
        <select value={leadId} onChange={(e) => setLeadId(e.target.value)} required style={{ display: "block", width: "100%", padding: 6 }}>
          <option value="" disabled>Select one…</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>
      <label>
        Target date (optional)
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      <label>
        Scope notes (internal — optional)
        <textarea value={scope} onChange={(e) => setScope(e.target.value)} rows={3} style={{ display: "block", width: "100%", padding: 6 }} />
      </label>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
      <button type="submit" disabled={submitting} style={{ padding: "8px 14px" }}>
        {submitting ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
