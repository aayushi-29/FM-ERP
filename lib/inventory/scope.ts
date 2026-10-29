import type { Role } from "@prisma/client";

// Not in the original baseline §4 matrix — this module (suppliers/raw
// materials) is new on the "Changed - Working Logic" branch. Modeled on
// the same shape as the rest of the app's scope files: NPD Executive
// manages it day-to-day (they're the one selecting ingredients/suppliers
// during Research → identify ingredients → ingredient selection), Admin
// can manage it too (matches Admin's "authorized access" role everywhere
// else), Project Lead can read it (so they can see what a project's
// formulation actually draws on) but not edit the company-wide catalog,
// and Client has no access at all — this is an internal operations record,
// not something in Client's "own projects; approved fields" row.
export function canManageInventory(role: Role): boolean {
  return role === "ADMIN" || role === "NPD_EXECUTIVE";
}

export function canReadInventory(role: Role): boolean {
  return role === "ADMIN" || role === "NPD_EXECUTIVE" || role === "PROJECT_LEAD";
}

// 29 Oct 2026 (fourth pass): materials-approval workflow, confirmed with
// the user — "give lead also the access to verify and accept" what an NPD
// Executive adds. This does NOT widen canManageInventory above (Project
// Lead still can't create/edit the catalog day-to-day) — it's a narrow,
// separate permission: approve or reject a material an NPD Executive
// submitted. Admin keeps it too, same as every other approval gate in the
// app ("Admin: override — any status, any time").
export function canApproveMaterials(role: Role): boolean {
  return role === "ADMIN" || role === "PROJECT_LEAD";
}
