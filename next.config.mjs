// Baseline security headers (closes the "transport security" gap flagged in
// the build brief's security checklist).
//
// Content-Security-Policy is NOT set here anymore. It used to be a static
// `script-src 'self'` with no 'unsafe-inline' and no nonce — which, in
// production, blocks every inline script Next.js itself emits (its RSC
// hydration payload scripts). That doesn't just break Fast Refresh in dev;
// it silently kills every client-side event handler on the page once
// deployed, because the page never finishes hydrating. That's why "Sign
// in" did nothing in production, not just in dev.
//
// The fix is a per-request nonce, which a static next.config.mjs header
// can't generate. See middleware.ts for the real CSP (nonce-based,
// enforced in production, skipped in dev for the Fast Refresh reason
// originally noted here).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // No "preload" yet — that submits the domain to browsers' hard-coded
  // HSTS list, which is hard to reverse. Add it once hosting (Decision #8)
  // is final and HTTPS has been stable for a while.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
