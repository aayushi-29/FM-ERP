import type { Metadata } from "next";
import { CURRENT_POLICY_VERSION } from "@/lib/legal/policy";

export const metadata: Metadata = { title: "Terms of Service — Food Monk ERP" };

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Same grounding note as app/legal/privacy/page.tsx: written to match what
// this app actually is (an internal, invite-only operations tool — no
// public signup, no subscription billed through this app, no consumer
// marketplace), not a generic SaaS terms template. [FILL IN] markers need
// real answers before this is relied on; this is not legal advice.
export default function TermsOfServicePage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem", lineHeight: 1.6 }}>
      <h1>Terms of Service</h1>
      <p className="fm-muted">Version {CURRENT_POLICY_VERSION}</p>

      <p>
        These Terms of Service govern access to Food Monk ERP (&ldquo;the platform&rdquo;), provided by{" "}
        <strong>[FILL IN: legal entity name]</strong> (&ldquo;Food Monk&rdquo;, &ldquo;we&rdquo;). By signing in,
        you agree to these terms.
      </p>

      <h2>Who this is for</h2>
      <p>
        This platform is invite-only. Accounts exist for Food Monk staff and for people at client organizations
        Food Monk works with, created by a Food Monk administrator. It is not a public product and there is no
        self-service signup.
      </p>

      <h2>Your account</h2>
      <p>
        Keep your login credentials confidential and tell us promptly if you suspect unauthorized access. Access
        is role-based: what you can see and do depends on the role and project assignments an administrator has
        given you.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Use the platform only for the legitimate business purpose it was provided to you for. Don&apos;t attempt
        to access data or accounts you haven&apos;t been authorized for, interfere with the platform&apos;s
        operation, or upload content you don&apos;t have the right to share.
      </p>

      <h2>Your content, your ownership</h2>
      <p>
        You and your organization retain ownership of the materials, formulations, documents, and other content
        you upload or create on the platform. Food Monk processes it solely to provide the platform&apos;s
        functionality to you and your organization, as described in the{" "}
        <a href="/legal/privacy">Privacy Policy</a>.
      </p>

      <h2>No fees charged through this platform</h2>
      <p>
        This platform does not itself charge subscription fees, process payments, or auto-renew anything — it is
        an internal tool, not a billed product sold to the people using it. (Separately, the platform helps Food
        Monk track invoices and payments owed <em>between</em> Food Monk and its clients for the underlying
        business relationship — that commercial arrangement, if any, is governed by your separate agreement with
        Food Monk, not by these Terms.)
      </p>

      <h2>Availability</h2>
      <p>
        We aim to keep the platform available and reliable but don&apos;t currently commit to a specific uptime
        percentage or formal service-level agreement. <strong>[FILL IN: if Food Monk wants to commit to a
        specific, realistic uptime target, state it here — only once it&apos;s something that can actually be
        backed up operationally.]</strong>
      </p>

      <h2>Termination</h2>
      <p>
        We may suspend or deactivate your access if these terms are violated, if your relationship with Food Monk
        ends, or for security reasons. You can ask us to delete your account and data via the{" "}
        <a href="/data-requests">Your data</a> page, subject to the retention limits in the Privacy Policy.
      </p>

      <h2>Disclaimer and liability</h2>
      <p>
        The platform is provided &ldquo;as is.&rdquo; To the extent permitted by law, Food Monk is not liable for
        indirect or consequential losses arising from use of the platform. <strong>[FILL IN: this paragraph and
        the governing-law clause below should be reviewed and finalized by a lawyer for your actual
        jurisdiction — a generic disclaimer is not a substitute for one tailored to your situation.]</strong>
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of <strong>[FILL IN: jurisdiction]</strong>.</p>

      <h2>Changes to these terms</h2>
      <p>
        If we make a material change, we&apos;ll update the version date above and ask you to re-confirm your
        acceptance the next time you sign in.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <strong>[FILL IN: a real contact email/address]</strong>.
      </p>
    </main>
  );
}
