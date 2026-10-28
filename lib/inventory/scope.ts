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
