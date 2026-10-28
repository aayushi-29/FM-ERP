"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function ConvertLeadForm({
  leadId,
  defaultProjectName,
  projectLeads,
}: {
  leadId: string;
  defaultProjectName: string;
  projectLeads: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [projectName, setProjectName] = useState(defaultProjectName);
  const [projectLeadId, setProjectLeadId] = useState(projectLeads[0]?.id ?? "");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectLeadId) {
      setError("No active Project Lead users exist yet — create one under Users first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          leadId: projectLeadId,
          targetDate: targetDate ? new Date(targetDate).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not convert this lead.");
        return;
      }
      router.push(`/projects/${data.project.id}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
      <label style={{ fontSize: ".85rem" }}>
        Project name
        <input
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          required
          style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
        />
      </label>
      <label style={{ fontSize: ".85rem" }}>
        Project Lead
        <select
          value={projectLeadId}
          onChange={(e) => setProjectLeadId(e.target.value)}
          style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
        >
          {projectLeads.length === 0 ? <option value="">No active Project Leads</option> : null}
          {projectLeads.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <label style={{ fontSize: ".85rem" }}>
        Target date (optional)
        <input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          style={{ display: "block", width: "100%", padding: 6, marginTop: 4 }}
        />
      </label>
      <button type="submit" disabled={submitting} style={{ padding: "6px 14px", marginTop: 4 }}>
        {submitting ? "Converting…" : "Convert to client & project"}
      </button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}
    </form>
  );
}
