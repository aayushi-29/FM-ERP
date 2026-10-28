// Baseline security headers (closes the "transport security" gap flagged in
// the build brief's security checklist). CSP is deliberately strict in
// production — loosen it only for a specific, documented reason (an
// embedded widget, a payment provider script), never by default.
//
// In development, Next.js's own Fast Refresh / HMR runtime evaluates code
// via eval() and injects inline scripts — the exact things a strict CSP is
// designed to block. A production-grade `script-src 'self'` with no
// 'unsafe-eval' breaks hot reload entirely (it threw "Executing a string
// as JavaScript violates CSP" from Next's own react-refresh-utils, and
// silently killed every client-side event handler on the page along with
// it — that's why "Sign in" did nothing). So CSP is skipped below in dev,
// and still fully enforced in production, which is the only environment
// where it needs to protect anything.
const isDev = process.env.NODE_ENV !== "production";

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
  ...(isDev
    ? []
    : [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join("; "),
        },
      ]),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
