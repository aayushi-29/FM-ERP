"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  TECHNICAL_SPEC: "Technical spec",
  FORMULATION_SUMMARY: "Formulation summary",
  TRIAL_RECORD: "Trial record",
  COMMERCIAL: "Commercial",
  OTHER: "Other",
};

export function UploadDocumentForm({
  projectId,
  allowedTypes,
  canSetVisibility,
}: {
  projectId: string;
  allowedTypes: readonly string[];
  canSetVisibility: boolean;
}) {
  const router = useRouter();
  const [type, setType] = useState(allowedTypes[0] ?? "OTHER");
  const [visibility, setVisibility] = useState<"INTERNAL_ONLY" | "CLIENT_VISIBLE">("INTERNAL_ONLY");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.set("type", type);
      if (canSetVisibility) body.set("visibility", visibility);
      body.set("file", file);

      const res = await fetch(`/api/projects/${projectId}/documents`, { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not upload that file.");
        return;
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", maxWidth: 560 }}>
      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ display: "block", padding: 6 }}>
          {allowedTypes.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </select>
      </label>
      {canSetVisibility ? (
        <label>
          Visibility
          <select value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} style={{ display: "block", padding: 6 }}>
            <option value="INTERNAL_ONLY">Internal only</option>
            <option value="CLIENT_VISIBLE">Client-visible</option>
          </select>
        </label>
      ) : null}
      <label style={{ flex: 1, minWidth: 200 }}>
        File
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
          style={{ display: "block", width: "100%" }}
        />
      </label>
      <button type="submit" disabled={submitting}>{submitting ? "Uploading…" : "Upload"}</button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem", width: "100%" }}>{error}</p> : null}
    </form>
  );
}
