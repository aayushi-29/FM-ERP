// Minimal CSRF defence for the cookie-based session: a state-changing
// request (POST/PUT/PATCH/DELETE) must come from this app's own origin.
// SameSite=Lax (set on the session cookie) already blocks most cross-site
// POSTs; this is the belt-and-braces check for the rest. Apply it in every
// mutating route handler, not just auth.
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return false;

  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
