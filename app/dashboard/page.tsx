import { requireUserOrRedirect } from "@/lib/auth/rbac";
import { SignOutButton } from "./sign-out-button";

// Reference implementation for every future protected page: call the
// redirect-on-fail helper first, then build the page around `user`. Copy
// this pattern — don't rely on layout nesting alone to imply protection.
export default async function DashboardPage() {
  const user = await requireUserOrRedirect();

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Welcome, {user.name}</h1>
      <p>
        Signed in as <strong>{user.role}</strong>. This is a placeholder —
        the real role-specific dashboards (baseline §11) land once the CRM,
        Projects, and NPD modules exist to read data from.
      </p>
      <SignOutButton />
    </main>
  );
}
