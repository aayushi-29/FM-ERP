"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

// "Ingredient COA (Certificate of Analysis) should be uploaded in image
// format" — the `accept` attribute is just a UI hint; the real enforcement
// is server-side in app/api/raw-materials/[id]/attachments/route.ts.
export function CoaUploadForm({ rawMaterialId }: { rawMaterialId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose an image to upload.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/raw-materials/${rawMaterialId}/attachments`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not upload the COA image.");
        return;
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ fontSize: ".82rem" }} />
      <button type="submit" disabled={submitting} style={{ fontSize: ".82rem", padding: "2px 8px" }}>
        {submitting ? "Uploading…" : "Upload COA"}
      </button>
      {error ? <p role="alert" style={{ color: "#b00020", fontSize: ".78rem", margin: 0 }}>{error}</p> : null}
    </form>
  );
}
