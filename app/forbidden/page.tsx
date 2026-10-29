import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { Shell } from "@/app/components/shell";

export const metadata: Metadata = { title: "Access Denied" };

// No requireUserOrRedirect() here on purpose — a signed-in user who got
// bounced here for lacking a role/record-level permission still needs a
// way to navigate elsewhere, so this looks up the session directly rather
// than redirecting them away from the page they're supposed to land on.
export default async function ForbiddenPage() {
  const user = await getCurrentUser();

  const body = (
    <>
      <h1>You don&apos;t have access to this page</h1>
      <p>If you think this is wrong, contact your Admin or Project Lead.</p>
    </>
  );

  if (!user) {
    return <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>{body}</main>;
  }

  return <Shell user={user}>{body}</Shell>;
}
