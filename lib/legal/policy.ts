// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
//
// Bump this string whenever Privacy Policy or Terms of Service content
// changes in a way that matters (not for typo fixes). Every user whose
// User.policiesVersion doesn't match this value is treated as "needs to
// re-accept" by app/components/shell.tsx, even if they accepted an older
// version before. Use an ISO date so it's trivially sortable/greppable.
export const CURRENT_POLICY_VERSION = "2026-11-12";
