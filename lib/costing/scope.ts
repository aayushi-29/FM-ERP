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

// Invoices/payments row: "Admin: Manage" / "Project Lead: Read authorized
// projects" / "NPD Executive: No access" / "Client: Own invoices and
// payment status" — Client DOES get a read route here, unlike Costing,
// but never a write one (payments are recorded by Admin from the bank
// side, not self-reported by a Client).
export function canReadInvoices(role: Role): boolean {
  return role === "ADMIN" || role === "PROJECT_LEAD" || role === "CLIENT";
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
