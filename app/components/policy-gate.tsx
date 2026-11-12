import Link from "next/link";

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Shown by Shell in place of page content for a signed-in user who hasn't
// accepted the current policy version yet. Kept deliberately simple —
// a dead end with one way out (/accept-policies) — rather than a full
// in-place form, so it can't be mistaken for having already agreed.
export function PolicyGate() {
  return (
    <div className="glass glass-card" style={{ maxWidth: 560, margin: "4rem auto", padding: "2rem", textAlign: "center" }}>
      <h2>Please review our updated policies</h2>
      <p className="fm-muted">
        We&apos;ve updated our Privacy Policy and Terms of Service. You&apos;ll need to review and accept them
        before continuing.
      </p>
      <Link href="/accept-policies" className="fm-btn" style={{ display: "inline-block", marginTop: "1rem" }}>
        Review and continue
      </Link>
    </div>
  );
}
