import type { Role } from "@prisma/client";

// Baseline §4 matrix, Costing row: "Admin: Manage" / "Project Lead: Read
// authorized projects" / "NPD Executive: No access by default" / "Client:
// Only prices disclosed through approved commercial documents" — so
// Client has NO direct route into CostSheet at all; their only pricing
// visibility is a COMMERCIAL-type Document someone with manage rights
// explicitly marked CLIENT_VISIBLE (the Documents module already built).
export function canReadCosting(role: Role): boolean {
  return role === "ADMIN" || role === "PROJECT_LEAD";
}
export function canManageCosting(role: Role): boolean {
  return role === "ADMIN";
}

// Invoices/payments row: narrowed on the "Changed - Working Logic" branch,
// 29 Oct 2026 (fourth pass), confirmed with the user — Project Lead and NPD
// Executive are paid by Admin separately from the project's own commercial
// terms, and should have no visibility into what the client is actually
// being charged or has paid ("he should not have the project budget idea").
// This DOES NOT touch canReadCosting above: a Project Lead can still see
// the production cost breakdown (materials, making charge, overheads,
// etc. on CostSheet) — that's the baseline's existing, unchanged "Costing"
// row. Only the client-facing commercial figures (Invoice.amount, payment
// claims, Payment records) are now Admin + Client only.
export function canReadInvoices(role: Role): boolean {
  return role === "ADMIN" || role === "CLIENT";
}
export function canManageInvoices(role: Role): boolean {
  return role === "ADMIN";
}

// Interpretation flag: the matrix doesn't say whether a Client should see
// a not-yet-sent DRAFT invoice. Read literally, "own invoices" could mean
// all of them — but a DRAFT is explicitly a working, not-yet-finalized
// number (no invoiceNumber meaning is settled, Decision #6 still open),
// so showing it to a Client risks them seeing — and acting on — a figure
// that changes before it's actually sent. This build hides DRAFT from
// Client; everything from SENT onward is visible. Change this one
// function if Food Monk wants Client to see drafts too.
export function isInvoiceVisibleToClient(status: string): boolean {
  return status !== "DRAFT";
}
