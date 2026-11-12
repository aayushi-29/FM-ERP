import type { Metadata } from "next";
import { CURRENT_POLICY_VERSION } from "@/lib/legal/policy";

export const metadata: Metadata = { title: "Privacy Policy — Food Monk ERP" };

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
//
// This is a template grounded in what this codebase actually does (checked
// by reading it, not assumed): no marketing emails are sent, no analytics
// or advertising SDKs are integrated, no payments are processed through
// this app, and there is no public self-signup (every account is created
// by an Admin — app/api/users/route.ts). Sections marked [FILL IN] need a
// real answer from Food Monk Innovations (legal entity name, registered
// address, a real contact address, and the actual hosting/database
// provider once chosen) before this is relied on. This is not a substitute
// for a lawyer's review — it's a accurate starting draft, not a finished
// legal document.
export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "3rem 1.5rem", lineHeight: 1.6 }}>
      <h1>Privacy Policy</h1>
      <p className="fm-muted">Version {CURRENT_POLICY_VERSION}</p>

      <p>
        This Privacy Policy describes how Food Monk ERP (&ldquo;the platform&rdquo;), operated by{" "}
        <strong>[FILL IN: legal entity name, e.g. Food Monk Innovations Pvt. Ltd.]</strong> (&ldquo;Food Monk&rdquo;,
        &ldquo;we&rdquo;, &ldquo;us&rdquo;), handles information about the people who use it.
      </p>

      <h2>Who this applies to</h2>
      <p>
        This platform is an internal operations tool. Accounts are created by a Food Monk administrator for Food
        Monk staff and for client-organization contacts invited to the Client Portal — there is no public
        self-signup. It is not directed at, and we do not knowingly collect data from, children under 18; if you
        believe a child&apos;s information has been entered here in error, contact us using the details below and
        we will remove it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account information: name, email address, role, and (for client contacts) the client organization you belong to.</li>
        <li>
          Work records you or your organization create or that are created about your work: leads, projects,
          milestones, tasks, formulations, cost sheets, invoices, payments, documents and attachments you upload,
          and raw-material/inventory records.
        </li>
        <li>Basic activity information needed for security and accountability: sign-in times, and an audit log of who changed what and when.</li>
      </ul>
      <p>We do not collect more than this platform needs to do its job, and we do not sell any of it.</p>

      <h2>Cookies</h2>
      <p>
        This platform sets exactly one cookie: <code>fm_session</code>, a first-party, strictly-necessary cookie
        that keeps you signed in. It is not used for advertising, cross-site tracking, or analytics, and no
        consent banner is shown for it, because strictly-necessary cookies are exempt from cookie-consent
        requirements under GDPR/ePrivacy and similar laws. If that ever changes — if any non-essential cookie,
        analytics, or tracking script is added — we will add a consent banner before it loads, not after.
      </p>

      <h2>Other tools we use</h2>
      <p>
        As of this version, no third-party analytics, advertising, or tracking SDKs are integrated into this
        platform (confirmed by review of the codebase, not just policy). Hosting and database infrastructure is
        <strong> [FILL IN: name the actual hosting/DB provider once chosen, e.g. &ldquo;hosted on ___, database on ___&rdquo;]</strong>.
        We will keep an up-to-date list of any such sub-processors at this URL once one is chosen, and will update
        this policy before adding a new one that would process personal data.
      </p>

      <h2>How long we keep data</h2>
      <p>
        We retain your account and work records for as long as your account is active or as needed to provide the
        platform to your organization. After an account is closed, we aim to delete or anonymize personal data
        within <strong>[FILL IN: e.g. 90 days]</strong> of closure or of a verified deletion request (see below),
        except where a longer period is required by law — for example, invoices and other financial records we
        may be legally required to keep for tax or accounting purposes.
      </p>

      <h2>Your rights</h2>
      <p>
        You can ask for a copy of the personal data we hold about you, or ask us to delete it, from the{" "}
        <a href="/data-requests">Your data</a> page once signed in. We aim to respond within 30 days. Deletion
        requests are reviewed manually — some information (like financial records tied to a project) may need to
        be retained or anonymized rather than fully deleted, for the legal reasons above; we&apos;ll tell you if
        that applies.
      </p>

      <h2>No use of your data to train AI models</h2>
      <p>We do not use your personal data or work records to train any AI/ML model, ours or a third party&apos;s.</p>

      <h2>Security</h2>
      <p>
        Passwords are stored hashed, never in plain text. Sessions are stored server-side and can be revoked
        immediately (for example, when an account is offboarded). Access to records is role- and
        assignment-based — a user only sees what their role and project assignments permit. Sensitive actions are
        recorded in an audit log. In production, the platform should only ever be served over HTTPS.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make a material change, we&apos;ll update the version date above and ask you to re-confirm your
        acceptance the next time you sign in.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy, or a data request you&apos;d rather send directly: <strong>[FILL IN: a real
        contact email/address for privacy requests]</strong>.
      </p>
    </main>
  );
}
