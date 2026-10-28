"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Version = {
  id: string;
  versionNumber: number;
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
};

type Doc = {
  id: string;
  type: string;
  visibility: "INTERNAL_ONLY" | "CLIENT_VISIBLE";
  uploadedByName: string;
  versions: Version[];
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentRow({
  document,
  canManage,
  canUploadVersion,
}: {
  document: Doc;
  canManage: boolean;
  canUploadVersion: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latest = document.versions[0];

  async function toggleVisibility() {
    setTogglingVisibility(true);
    setError(null);
    try {
      const next = document.visibility === "CLIENT_VISIBLE" ? "INTERNAL_ONLY" : "CLIENT_VISIBLE";
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not change visibility.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function uploadNewVersion() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/documents/${document.id}/versions`, { method: "POST", body });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not upload a new version.");
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <li style={{ padding: "10px 0", borderBottom: "1px solid #eee" }}>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".85rem" }}>{error}</p> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <strong>{document.type.replace(/_/g, " ")}</strong>
        <span style={{ color: "#777", fontSize: ".85rem" }}>
          {document.visibility === "CLIENT_VISIBLE" ? "Client-visible" : "Internal only"} · uploaded by {document.uploadedByName}
        </span>
        {canManage ? (
          <button disabled={togglingVisibility} onClick={toggleVisibility} style={{ fontSize: ".8rem" }}>
            {togglingVisibility
              ? "Updating…"
              : document.visibility === "CLIENT_VISIBLE"
                ? "Make internal"
                : "Make client-visible"}
          </button>
        ) : null}
      </div>

      {latest ? (
        <p style={{ margin: "4px 0 0", fontSize: ".9rem" }}>
          <a href={`/api/documents/${document.id}/versions/${latest.id}/download`}>
            {latest.fileName}
          </a>
          <span style={{ color: "#777" }}>
            {" "}(v{latest.versionNumber} · {formatSize(latest.fileSizeBytes)} · {new Date(latest.uploadedAt).toLocaleDateString()})
          </span>
        </p>
      ) : null}

      {document.versions.length > 1 ? (
        <details style={{ marginTop: 4 }}>
          <summary style={{ fontSize: ".82rem", color: "#777", cursor: "pointer" }}>
            {document.versions.length - 1} earlier version{document.versions.length - 1 === 1 ? "" : "s"}
          </summary>
          <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0" }}>
            {document.versions.slice(1).map((v) => (
              <li key={v.id} style={{ fontSize: ".85rem" }}>
                <a href={`/api/documents/${document.id}/versions/${v.id}/download`}>{v.fileName}</a>
                <span style={{ color: "#777" }}> (v{v.versionNumber} · {formatSize(v.fileSizeBytes)})</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {canUploadVersion ? (
        <div style={{ marginTop: 6, display: "flex", gap: 6, alignItems: "center" }}>
          <input ref={fileInputRef} type="file" style={{ fontSize: ".82rem" }} />
          <button disabled={uploading} onClick={uploadNewVersion} style={{ fontSize: ".82rem" }}>
            {uploading ? "Uploading…" : "Upload new version"}
          </button>
        </div>
      ) : null}
    </li>
  );
}
