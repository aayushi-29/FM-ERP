import type { Metadata } from "next";
import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { CURRENT_POLICY_VERSION } from "@/lib/legal/policy";
import { redirect } from "next/navigation";
import { AcceptPoliciesForm } from "./accept-policies-form";

export const metadata: Metadata = { title: "Accept policies" };

// 12 Nov 2026, "legal-compliance" branch — see docs/decisions.md item #19.
// Deliberately bare (no Shell/nav) so this page itself never triggers the
// policy gate Shell renders for everyone else — there's nowhere to loop to.
// Already-accepted users are bounced to /dashboard rather than shown this
// again.
export default async function AcceptPoliciesPage() {
  const user = await requireUserOrRedirect();
  if (user.policiesAcceptedAt && user.policiesVersion === CURRENT_POLICY_VERSION) {
    redirect("/dashboard");
  }

  return (
    <main className="fm-login">
      <div className="fm-login-card glass glass-strong glass-card">
        <h1>Before you continue</h1>
        <p className="fm-muted fm-login-sub">
          We&apos;ve updated our Privacy Policy and Terms of Service. Please take a look and confirm you accept
          them to keep using Food Monk ERP.
        </p>
        <AcceptPoliciesForm />
      </div>
    </main>
  );
}
