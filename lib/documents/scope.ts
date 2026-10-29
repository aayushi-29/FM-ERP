import type { DocumentType, Role } from "@prisma/client";

// Baseline §4 Documents row: "Manage visibility and access" (Admin) /
// "Manage authorized project documents" (Project Lead) / "Upload permitted
// technical documents" (NPD Executive) / "Upload permitted types; download
// approved files" (Client).
//
// Interpretation flag: the matrix names "permitted types" for NPD
// Executive without listing them. Read literally against the rest of the
// matrix: NPD Executive's whole mandate here is *technical* documents, so
// TECHNICAL_SPEC and TRIAL_RECORD. Admin and Project Lead can upload any
// type, matching their "manage" language. If Food Monk wants NPD
// Executive to reach more types, this is the one place to widen it.
//
// 29 Oct 2026 (second pass): Client's upload right (previously OTHER only)
// is removed entirely — confirmed with the user. A Client should only ever
// download documents an internal role marked CLIENT_VISIBLE, never upload
// their own; see docs/decisions.md. CLIENT maps to an empty array rather
// than being left out of the record, so canUploadType stays a total
// function and every role is still explicit here.
const UPLOAD_TYPES_BY_ROLE: Record<Role, DocumentType[]> = {
  ADMIN: ["CONTRACT", "TECHNICAL_SPEC", "FORMULATION_SUMMARY", "TRIAL_RECORD", "COMMERCIAL", "OTHER"],
  PROJECT_LEAD: ["CONTRACT", "TECHNICAL_SPEC", "FORMULATION_SUMMARY", "TRIAL_RECORD", "COMMERCIAL", "OTHER"],
  NPD_EXECUTIVE: ["TECHNICAL_SPEC", "TRIAL_RECORD"],
  CLIENT: [],
};

export function canUploadType(role: Role, type: DocumentType): boolean {
  return (UPLOAD_TYPES_BY_ROLE[role] ?? []).includes(type);
}

// Only the two roles whose matrix row says "manage"/"manage visibility and
// access" may set or change a document's visibility. Everyone else's
// uploads land as INTERNAL_ONLY regardless of what they ask for — nothing
// an NPD Executive or Client uploads can become client-visible (or more
// internal than it already is) without a managing role reviewing it first.
export function canManageVisibility(role: Role): boolean {
  return role === "ADMIN" || role === "PROJECT_LEAD";
}

// baseline §9: "Validate file size/type ... before making files
// available." No malware-scanning provider is wired up in this MVP
// (flagged in README) — this allowlist is the first, cheap layer: reject
// anything that isn't a plain document/image/spreadsheet type outright,
// whatever the role.
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
