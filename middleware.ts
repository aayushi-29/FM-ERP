// Per-request nonce-based Content-Security-Policy.
//
// Why this exists instead of the static CSP header that used to live in
// next.config.mjs: a static `script-src 'self'` has no way to allow the
// inline <script> tags Next.js itself injects for RSC hydration payloads.
// Without 'unsafe-inline' (which defeats the point of a script-src
// allowlist) or a nonce, those inline scripts get blocked by the browser —
// the page never finishes hydrating, and every client-side event handler
// (including the login form's submit handler) silently does nothing.
//
// The fix, per Next.js's own CSP guide, is to generate a fresh nonce per
// request here, put it in the CSP response header, and forward it to the
// app via an `x-nonce` request header. Next.js then automatically tags its
// own emitted inline scripts with that nonce so they're allowed to run.
//
// CSP is skipped in development because Next's Fast Refresh / HMR runtime
// evaluates code via eval() and injects its own inline scripts, which a
// strict script-src also blocks — that's a dev-only concern, not a
// production security requirement.
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  if (!isDev) {
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      // Google Fonts' stylesheet is served from fonts.googleapis.com, and
      // its actual font files from fonts.gstatic.com — both need an
      // explicit allowance, or the browser blocks them under the
      // default-src fallback.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    response.headers.set("Content-Security-Policy", csp);
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
