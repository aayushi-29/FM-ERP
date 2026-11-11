// Permanently deleting a user (as opposed to deactivating one, which any
// Admin can already do) is irreversible and, for a user with no related
// records, leaves no audit trail of who the account even was. We restrict
// it to a single named Admin account rather than "any Admin" so that one
// severe action always has one accountable owner, instead of quietly
// becoming routine because every Admin can do it.
//
// Configurable via env var so the designated account can change without a
// code deploy; falls back to the account the user had us seed, so removing
// the env var fails closed (restricts to that one account) rather than
// opening the action up to every Admin.
export const PRIMARY_ADMIN_EMAIL = (process.env.PRIMARY_ADMIN_EMAIL ?? "admin@gmail.com").toLowerCase();

export function isPrimaryAdmin(email: string): boolean {
  return email.toLowerCase() === PRIMARY_ADMIN_EMAIL;
}
