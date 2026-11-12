import Link from "next/link";

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// A real footer did not exist anywhere in the app before this; added
// purely to make the Privacy Policy, Terms of Service, and the data-rights
// request page reachable from every signed-in screen, not just linked from
// the accept-policies interstitial.
export function Footer() {
  return (
    <footer className="fm-footer">
      <nav aria-label="Legal">
        <Link href="/legal/privacy">Privacy Policy</Link>
        <Link href="/legal/terms">Terms of Service</Link>
        <Link href="/data-requests">Your data</Link>
      </nav>
      <span className="fm-muted">&copy; {new Date().getFullYear()} Food Monk Innovations</span>
    </footer>
  );
}
