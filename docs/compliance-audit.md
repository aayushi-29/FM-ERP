# Compliance audit — "legal-compliance" branch (12 Nov 2026)

You asked for a long list of legal/compliance items to be checked and fixed
where applicable, on a separate branch. This document is the honest,
item-by-item result: what was actually found in the codebase, what was
fixed, and — for most of the list — why it doesn't apply to this app as it
exists today. I'm not a lawyer; nothing here is legal advice, and the new
Privacy Policy/Terms pages have `[FILL IN]` markers that need a real answer
(and ideally a lawyer's review) before you rely on them.

**Why so much of the list is "N/A"**: this app is an internal, invite-only
B2B operations tool. Accounts are created by an Admin
(`app/api/users/route.ts`) — there is no public self-signup, no marketing
site, no email sending, no payment/subscription processing through the app
itself, and (confirmed by grepping the codebase, not assumed) no
third-party analytics, advertising, or tracking SDK anywhere in it. A large
fraction of the checklist is written for a public consumer SaaS product
with marketing emails and billed subscriptions — that's simply not what
this is, so there's nothing present to fix for those items.

## Fixed in this branch

| Item | What was found | What was done |
|---|---|---|
| Add a privacy policy | None existed | `app/legal/privacy/page.tsx` — public page, grounded in this app's actual data handling |
| Add terms of service | None existed | `app/legal/terms/page.tsx` — public page, same grounding |
| Add a checkbox to accept the privacy policy and terms | None existed | `app/accept-policies/` — checkbox form, blocks the app via `Shell` until accepted |
| Record acceptance of the terms | Not tracked anywhere | `User.policiesAcceptedAt` + `policiesVersion` (timestamped, versioned — not just a boolean), written by `/api/auth/accept-policies` and logged to the existing audit log |
| Enable data access and deletion requests | No mechanism existed | `app/data-requests/` (any user can request export or deletion) + `app/admin/data-requests/` (Admin marks it fulfilled/declined). Intake and audit trail are real; fulfillment itself is a manual admin action, same trust model as the rest of this app |
| Set data retention limits | No stated policy | Documented in the Privacy Policy, with a `[FILL IN]` for the exact number of days — that's a business decision, not something to invent |
| Fix color contrast | ~18 files used inline `#777`/`#888`/`#999` for body text — contrast ratio ~2.9–4.5:1 against white, under WCAG AA's 4.5:1 for normal text | Darkened to `#5f5f5f` (~6.4:1, passes AA with margin) |
| Enable keyboard navigation | One mouse-only `<span onClick>` found (`app/notifications/notification-feed.tsx`, marking a notification read when it has no link) — no keyboard focus or activation | Changed to a real `<button>` |
| Add alt text | Checked every `<img>` in `app/` | Already had `alt` text on all of them — nothing to fix |
| Audit third-party SDKs, analytics, and tracking | Grepped for analytics/ad/tracking SDKs (Google Analytics, Segment, Mixpanel, Amplitude, Hotjar, Meta Pixel, PostHog, etc.) | None found. Stated in the Privacy Policy; if one is ever added, the policy says it'll be disclosed and (per the cookie item below) gated behind consent first |
| Check open source license obligations | Reviewed `package.json`'s dependencies | All are permissive (MIT or Apache-2.0: Next.js, React, Prisma, Zod, bcryptjs, decimal.js, TypeScript, ESLint, Vitest) — no copyleft/GPL obligations, nothing that requires attribution in the shipped product |
| Verify image, font, and code licenses | Checked `public/` | Only asset is Food Monk's own `logo.png`. No third-party stock images, no custom web fonts bundled, no customer logos present anywhere |
| Don't use customer logos without permission | Checked `public/` and the codebase for any logo usage | No customer/third-party logos exist in the app at all |

## Not applicable — nothing present to fix

| Item | Why it doesn't apply here |
|---|---|
| Add a cookie banner / block trackers until consent | The app sets exactly one cookie — `fm_session`, first-party, strictly necessary for login. No advertising/analytics cookies exist. Strictly-necessary cookies are exempt from consent requirements under GDPR/ePrivacy — a consent gate here would only break login, not protect anyone. Disclosed plainly in the Privacy Policy instead of a banner nobody needs to see |
| Add unsubscribe option to marketing emails / add separate marketing consent | No marketing emails are sent — there's no mailer integration in the codebase at all (checked for SendGrid/Mailgun/SES/Resend/nodemailer: none found) |
| Add a refund policy / state auto-renewals / make subscriptions easy to cancel / remove hidden fees | No payment or subscription processing happens through this app (checked for Stripe/Razorpay/PayPal-style integrations: none found). The app *tracks* invoices/payments between Food Monk and its clients, but doesn't bill the people using it |
| Remove fake countdown timers | None exist anywhere in the UI |
| Remove fake reviews / unsupported claims / false SOC2 claims / realistic uptime commitments | Checked the README and all docs for review/testimonial content and for SOC2/uptime/"99.9%"/superlative marketing language — none found. (The Terms page does leave a place to state a real uptime commitment later, if you ever want to make one — only once it's something you can actually back up operationally) |
| Remove dark patterns | No pattern matching common dark-pattern shapes (forced continuity, confirm-shaming, hidden unsubscribe, pre-checked upsells) exists — there's no checkout/subscription flow in the first place |
| Obtain parental consent before collecting children's data | This is a professional B2B tool; it isn't directed at and doesn't knowingly collect data from children. Stated plainly in the Privacy Policy rather than building a parental-consent flow for a case that doesn't occur by design |
| Label AI-generated content | The app itself doesn't generate or display AI-generated content to its users — nothing to label |
| Check DMCA registration requirements | DMCA safe-harbor registration is for platforms hosting public user-generated content; this app has no public-facing content hosting |
| Prevent unauthorized AI training on user data | No pipeline in this codebase sends user data anywhere for AI training. Stated explicitly in the Privacy Policy as a commitment going forward |

## Needs a human, not code

These are real, legitimate items — they just aren't things I can write code
to satisfy, because the honest answer depends on facts only Food Monk has,
or a contract with a third party:

- **Business contact details, legal entity name, registered address,
  governing-law jurisdiction** — left as `[FILL IN]` in both legal pages.
- **A real data-retention period** (e.g. "90 days after account closure") —
  a business decision; placeholder left in the Privacy Policy.
- **Naming the actual hosting/database provider**, and publishing a
  sub-processors list — not yet chosen as of this audit; the Privacy Policy
  commits to listing it once it is.
- **Data Processing Agreements (DPAs)** with whichever hosting/database/any
  future sub-processor you choose — this is a contract between Food Monk
  and that vendor, signed outside this codebase.
- **A lawyer's review** of the disclaimer/liability and governing-law
  clauses in the Terms of Service — a generic draft, however carefully
  grounded, isn't a substitute for review by someone qualified for your
  actual jurisdiction.
- **A real uptime commitment**, if you want to make one — only once it's
  something you can operationally back up.

## Verification

- Full test suite: 90/90 passing, no regressions (`npm test`).
- Lint: clean on every new/changed file (`npm run lint`).
- Schema change is additive only — two new nullable `User` columns, one new
  table (`DataSubjectRequest`) — nothing existing was altered or removed.
