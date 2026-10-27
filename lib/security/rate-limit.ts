// Placeholder in-memory limiter for the login route — stops naive brute
// forcing during development only. It does NOT work correctly once the app
// runs as more than one server instance (each instance has its own memory),
// which any real production deployment will be. Before go-live this must be
// replaced with a shared store (Redis/Upstash, or the hosting provider's own
// rate limiting) — tracked in the security checklist as an open item.
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}
