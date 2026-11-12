# Security audit — "legal-compliance" branch (12 Nov 2026)

Same approach as `docs/compliance-audit.md`: every item below was actually
checked against this codebase (grep, manual review, `npm audit`), not
assumed. The honest finding is that most of this list was **already solid**
going into this pass — the codebase's own comments reference an earlier
"build brief's security checklist" it was already built against. What
follows is what was verified, what was genuinely missing and got fixed, and
what's flagged rather than force-fixed because fixing it blind would be
riskier than leaving it documented.

## Already in place (verified, not assumed)

| Item | Where / how |
|---|---|
| Authentication | `lib/auth/session.ts` — DB-backed sessions (not stateless JWTs, so a session can be revoked immediately), `fm_session` cookie is `httpOnly`, `secure` in production, `sameSite: "lax"` |
| Admin routes protected | Every one of the 60 mutating API routes calls `requireUser`/`requireRole`; every page except the public landing page, login, and legal pages calls `requireUserOrRedirect`/`requireRoleOrRedirect`. No route or page found without one (checked all of them, not a sample) |
| Users only access their own data | Role checks alone aren't enough and aren't relied on alone — record-level scoping (`clientOrgId`, `assertProjectAccess`, `canRead*`/`canManage*` helpers) gates the data itself; covered by `tests/*/scope.test.ts` and `tests/auth/project-access.test.ts` |
| CSRF protection | `lib/security/origin.ts`'s same-origin check, called in all 60 mutating routes, on top of `SameSite=Lax` on the session cookie |
| Rate limiting | `lib/security/rate-limit.ts` — login is rate-limited per email (10 attempts / 15 min), with a documented, honest caveat: it's in-memory, so it only works correctly on a single server instance — flagged in the code itself as needing a shared store (Redis/Upstash) before a multi-instance production deploy |
| Security headers | `next.config.mjs` already sets CSP (strict in production, relaxed only for dev's hot-reload), HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy |
| Sanitize forms / input validation | 53 of 59 mutating routes validate with Zod; the other 6 either take no body (approve/verify/acknowledge actions, logout) or validate multipart file uploads manually (type allowlist + size cap — see below) |
| XSS protection | No `dangerouslySetInnerHTML`, no `eval`/`innerHTML` anywhere in the codebase; React's default escaping plus a `script-src 'self'` CSP |
| File upload validation | `app/api/raw-materials/[id]/attachments/route.ts` enforces an image-MIME allowlist and a 10MB cap; `lib/storage/local.ts` resolves every file key against its root directory and throws rather than allow escaping it (path-traversal defense in depth) |
| Password hashing | bcrypt, cost factor 12 (above the library default of 10), via `lib/auth/password.ts`; a server-side minimum length check exists (not just client-side) |
| Debug / error handling | `lib/api/respond.ts` never returns a stack trace or internal error detail — generic "Something went wrong" + a server-side `console.error`. No debug/test/bypass routes found anywhere in `app/api` |
| No secrets in the codebase | Grepped for AWS keys, private-key headers, hardcoded DB credentials with real-looking passwords: none found. `.env` is gitignored; only `.env.example` (all placeholder values) is tracked |
| Git history clean | Scanned the **full** history (`git log --all -p`), not just the current tree, for the same secret patterns and for any commit that ever added a `.env`/`.env.local` file: none found |
| Database access | Connection string only ever read by Prisma itself via `DATABASE_URL`/`DIRECT_URL`; never logged, never sent to the client; no query logging enabled (so no risk of a logged query leaking a password/token in production) |

## Fixed in this pass

| Item | Finding | Fix |
|---|---|---|
| Exposed framework info | Next.js sends `X-Powered-By: Next.js` by default | `poweredByHeader: false` added to `next.config.mjs` |
| Search-engine indexing | No `robots.txt` existed — a private internal tool has no reason to ever be crawled/indexed | Added `public/robots.txt` disallowing everything |
| Dependency vulnerabilities (safe subset) | `npm audit` showed 18 known vulnerabilities, all in transitive dev-tooling dependencies | Ran `npm audit fix` (not `--force`) — picks up every fix available within the existing version ranges, with no breaking change. Verified: `package.json` unexpectedly unchanged (only the lockfile moved, as expected), full 90-test suite still green, lint still clean |

## Flagged, not force-fixed

`npm audit` still reports 18 vulnerabilities after the safe fix above. Every
remaining one requires a **major version bump** (`next` 14→16, `vitest` 2→5,
`zod` 3→4) to clear — there's no patched release on the current major line
for any of them. I did not force these:

- **`zod` 3→4** (high — a DoS via oversized input is the actual
  vulnerability, in `zod`, which validates input on every one of this app's
  53 API route schemas). This is a real, runtime-relevant issue, not just a
  dev-tooling one — it's the highest-priority item on this list. But Zod
  v4 renamed/changed parts of its API (e.g. `z.string().email()` →
  `z.email()`, error-customization shape), so a blind bump risks silently
  breaking input validation across the app in ways this sandbox can't catch
  (no live database, no real dev-server smoke test, and `tsc` already has
  unrelated pre-existing errors from the Prisma-client generation limits
  here — see `tests/setup/fakePrisma.ts` — so it can't be used as a safety
  net either). **Recommended next step**: a dedicated pass, on its own
  branch, that upgrades Zod and re-tests every schema against a real
  dev server before merging — not something to do as a drive-by inside a
  compliance/security sweep.
- **`next` 14→16** and **`vitest` 2→5** — the remaining flagged issues here
  (a Server Actions DoS, and a few build-tool-chain CVEs in `postcss`/
  `tinypool`) don't apply to this app's actual runtime attack surface as it
  stands: this app doesn't use Server Actions anywhere (checked — no
  `"use server"` in the codebase; everything goes through explicit
  `/api/*` route handlers), and `tinypool`/`postcss`'s vulnerable code
  paths only run inside the test runner and the build process, never in
  front of a real user. Both are still worth clearing eventually for
  defense-in-depth, but a two-major-version framework bump is a
  significant undertaking that deserves its own planned pass with real
  testing, not something to force through unverified in the same sweep as
  everything else here.

## Not applicable / nothing found

- **"Remove anything I don't need"** — reviewed `scripts/`, `public/`, and
  the repo root for dead/backup/scratch files. The only script present
  (`scripts/cleanup-leaked-finance-notifications.ts`) is a deliberate,
  already-run one-off data-migration tool, not leftover debug code —
  nothing removed.
- **"Check core settings" / "turn off debug mode"** — no separate debug
  flag exists in this app; `NODE_ENV` is the only environment switch, and
  every place that reads it (`lib/prisma.ts`'s dev-only global singleton,
  the session cookie's `secure` flag, the CSP's dev/prod split) already
  behaves correctly in each environment.
- **"Check for exposed files"** — `public/` contains only the app's own
  logo; no `.env`, no `.git`, no backup/config files are ever served
  statically.

## Verification

- Full test suite: 90/90 passing, no regressions (`npm test`).
- Lint: clean repo-wide except one pre-existing, unrelated Next.js font
  warning in `app/layout.tsx` (`npm run lint`).
- `package.json` unchanged by the safe dependency fix; only the lockfile
  moved, within existing version ranges.
