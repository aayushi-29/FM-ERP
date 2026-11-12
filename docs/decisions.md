# Confirmed decisions — Food Monk ERP

Confirmed 28 Oct 2026. These are the business-rule gaps the original system-design
baseline flagged as "must be confirmed before implementation." Two (#7, #11) were
decided directly; the rest carry forward recommended answers accepted as the build
direction. Three (#4, #6, #12) still need a named accountant / security-legal
reviewer to confirm exact figures before launch — don't hard-code numbers for those
until that happens. #13–#15 are additions confirmed on 29 Oct 2026, not gaps the
original baseline flagged — see the superseding note below for why each was added
rather than drawn from the baseline.

| # | Decision | Direction | Status |
|---|---|---|---|
| 1 | 4-role matrix & approval authority | Admin / Project Lead / NPD Executive / Client as defined in the baseline; final per-workflow approval authority named during build | Accepted |
| 2 | Multi-user client orgs | Yes — multiple logins per client organization, each scoped to that org only | Accepted |
| 3 | Formulation approval & reapproval | Draft / In Review / Approved / Rejected; changes to ingredients, quantities, or designated critical process fields trigger a new version + reapproval | Accepted |
| 4 | Costing formula | Ingredient cost × yield/wastage + packaging/processing/labour/testing/overhead; estimate vs. actual kept separate | **Accepted — needs accountant sign-off on exact formula/rates** |
| 5 | Payment milestones | Contract-specific, configurable — not a fixed split | **Superseded 28 Oct 2026 on the "Changed - Working Logic" branch — see note below** |
| 6 | Invoicing & GST/tax | Configurable invoice numbering; tax rules follow the accountant, never hard-coded | **Accepted — needs accountant sign-off** |
| 7 | Inventory/lot tracking in MVP | Deferred to Phase 2, per baseline §3 — supplier/material *records* only in MVP, no stock ledger | **Superseded 29 Oct 2026 on the "Changed - Working Logic" branch — see note below** |
| 8 | Hosting & file storage | Keep Next.js/Prisma/PostgreSQL; private object storage, no public file URLs; provider TBD | Accepted |
| 9 | Backup / RPO-RTO / offboarding | Starting targets: RPO ≤ 24h, RTO ≤ 8h (revisit once host is picked); immediate access revocation on offboarding | Accepted |
| 10 | WhatsApp / external accounting / client-facing AI | All deferred from MVP until a confirmed need exists | Accepted |
| 11 | Brand colour tokens | Logo-derived palette — maroon `#4A2317`, gold `#C98A1F`, terracotta `#A8441F`, cream `#FBF5E9`, ink `#2B1810` | Decided |
| 12 | Pen test & DPDP Act review | Yes, both before go-live; critical/high findings remediated first | **Accepted — needs reviewer booked** |
| 13 | Proposal/Quotation workflow | New: Create → Internal Review → Approval → Send to Client, with a revision loop back to Create. Gates lead conversion. | **Added 29 Oct 2026 on the "Changed - Working Logic" branch — see note below** |
| 14 | Cost Intelligence — suggested selling price | New: optional markup-on-cost input produces a non-authoritative suggested selling price alongside each cost sheet | **Added 29 Oct 2026 on the "Changed - Working Logic" branch — see note below** |
| 15 | Dedicated Client Portal page | New: a consolidated Client-facing landing page (own project status, milestones, approved documents, invoices), in addition to the existing dashboard/project views | **Added 29 Oct 2026 on the "Changed - Working Logic" branch — see note below** |
| 16 | Client payment claims | New: a Client can submit a claim that they've paid an invoice (amount, bank account, mode, acknowledgement/reference no.); an Admin verifies it by Acknowledging (which creates the real Payment) or Rejecting (with a reason). The existing Admin-only Payment recording path is unchanged and stays the system of record. | **Added 29 Oct 2026 (second pass) on the "Changed - Working Logic" branch — see note below** |
| 17 | MRP visibility to client | New: an Admin-entered `recommendedMrp` on a CostSheet, publishable as a single number ("MRP") on the client's project view. The CostSheet record itself (cost breakdown, `canReadCosting`) stays completely closed to Client — only this one published number is ever exposed. | **Added 29 Oct 2026 (second pass) on the "Changed - Working Logic" branch — see note below** |
| 18 | Category-aware stock batches | New: raw materials get a `category` (Standard / Perishable / Packaging) and an optional per-batch expiry. Every delivery is its own `StockBatch`, and staff log how much of a batch was Used or Wasted, giving a real received/used/wasted/remaining number per material instead of one pooled total. Deliberately additive to item #7's `stockOnHand`/`StockMovement` (unchanged, still the running total) rather than a replacement. | **Added 11 Nov 2026 on the "Changed - Working Logic" branch — see note below** |
| 19 | Legal/compliance pass | New: Privacy Policy + Terms of Service pages, a versioned accept-and-record consent flow (`User.policiesAcceptedAt`/`policiesVersion`), a user-facing data access/deletion request flow (`DataSubjectRequest`) with an Admin fulfillment queue, and an accessibility contrast fix. Most of a much longer checklist the user asked about turned out to be N/A for this app (no marketing emails, no subscriptions/payments through this app, no trackers/analytics, no public signup, no reviews or countdown timers) — see `docs/compliance-audit.md` for the full item-by-item breakdown. | **Added 12 Nov 2026 on the "legal-compliance" branch (off Changed-Working-Logic) — see note below** |
| 20 | Security audit pass | Audited (not assumed) against a long security checklist — see `docs/security-audit.md`. Most of it was already solid (auth, admin-route/row-level scoping, CSRF, login rate-limiting, CSP/security headers, bcrypt cost 12, no stack-trace leaks, no secrets in the codebase or its git history). Fixed: `poweredByHeader: false`, a disallow-all `robots.txt`, and a safe (non-breaking) `npm audit fix`. Flagged rather than force-fixed: three dependencies (`zod`, `next`, `vitest`) whose remaining advisories only clear via a major version bump — too risky to force blind in this sandbox (no live DB/dev-server to verify against). | **Added 12 Nov 2026 on the "legal-compliance" branch — see note below** |

## Non-negotiables carried into every module

1. Preserve this codebase going forward — no framework rewrite without a documented limitation.
2. Authorization is enforced on the server on every route, record, export, and file download. Hiding a menu item is not security.
3. Formulation versions are immutable once approved; a change creates a new version.
4. Every cost calculation records its own inputs/assumptions (`CostSheet`), so a historical number stays explainable.
5. Finance fields (milestones, tax, invoice numbering) are configurable, never hard-coded defaults.
6. Core ERP (CRM, projects, NPD, documents, costing, approvals, dashboards) ships and is reliable before any AI/RAG work starts.

Full rationale and the phased roadmap: see the Build Brief artifact shared alongside this repo, and the original baseline document (`Food Monk ERP — System Design & Implementation Baseline`, v1.0).

## Superseding note — "Changed - Working Logic" branch (28 Oct 2026)

A later requirements pass replaced Decision #5's "contract-specific, configurable" payment
structure with a fixed split, and added several features not covered by the original
baseline. Decision #5's original row above is kept, not deleted, so the history of why
the split changed stays visible. The new direction:

- **Payment milestones are now fixed**: 60% advance, 25% after the first sample, 15%
  before final handover (`PaymentStage` enum; `lib/payments/stage.ts` is the single
  place the percentages/labels live). An invoice can still be created without a stage
  for anything ad-hoc — the field is nullable — so this stays backward-compatible with
  invoices created before the change.
- **Execution gate**: confirmed with the user (29 Oct 2026) to mean *nothing* starts
  before the advance — not just tasks/trials, but creating a Product, Formulation, or
  ingredient line too (`Project.advancePaymentVerifiedAt`,
  `lib/projects/execution-gate.ts`). There's still no payment gateway — verification is
  always a human (Admin) confirming an offline/email acknowledgement, exactly as before;
  this just gates work on that confirmation having happened.
- **25% stage gate**: confirmed with the user that "after 1st sample" means a `SECOND_25`
  invoice can't be raised until at least one `Trial` has been logged on the project
  (`lib/payments/stage-gates.ts`'s `assertFirstSampleExists`).
- **15% stage gate / handover**: confirmed with the user that "before handling the final
  product" means marking the project `COMPLETED` (the handover action, a new Admin-only
  control on the project page) is blocked until the `FINAL_15` invoice's `Payment` is
  verified (`lib/payments/stage-gates.ts`'s `assertFinalPaymentVerified`). Both sides are
  notified on handover, same as every other payment-stage event.
- **In-app notifications**: a `Notification` model and `lib/notifications.ts`'s
  `notify()` helper fire on invoice creation (when staged) and payment verification, to
  "company" (Admins + the project's assigned Project Lead/NPD Executive), "client"
  (active Client users in the project's org), or both. This is in-app only — no email/SMS
  infra exists or was added for this.
- **Inventory/supplier UI**: Decision #7 (records only, no stock ledger, deferred to
  Phase 2) is unchanged — this only adds the UI/API for the `Supplier`/`RawMaterial`
  records that already existed in the schema but had no routes or pages
  (`lib/inventory/scope.ts`, `/raw-materials`).
- **Ingredient COA images**: a new `RawMaterialAttachment` model stores Certificate of
  Analysis uploads, restricted to image MIME types only (enforced in
  `app/api/raw-materials/[id]/attachments/route.ts`, not the schema).
- **Client rework requests**: a `RevisionRequest` model lets a Client ask for a change
  on an **APPROVED** formulation version without mutating it (still immutable per
  Decision #3). NPD/Admin addresses it through the existing revise flow, which can link
  the new version back to the request.
- **Trial sheets**: now rendered as an HTML table instead of a list (no behavior change
  to the existing create/update/attach/remove actions).

## Superseding note — "Changed - Working Logic" branch (29 Oct 2026)

A set of four additions confirmed with the user on top of the above. Three (Decision
#13, #14, #15) are new scope the original baseline never described; one (#7) is an
explicit reversal of a prior decision. None of this removes or changes the behavior
documented in the first superseding note above — it's additive, and every existing
route/page continues to work as already documented.

- **Decision #13 — Proposal workflow**: a new `Proposal` model, linked to `Lead`
  (`prisma/schema.prisma`; `Lead` previously had no relations at all). Statuses
  `DRAFT` → `INTERNAL_REVIEW` → `SENT` → `ACCEPTED`/`REVISION_REQUESTED`
  (`ProposalStatus`). `app/api/leads/[id]/proposals/route.ts` creates a draft;
  `app/api/proposals/[id]/route.ts`'s PATCH edits a draft or submits it for review;
  `app/api/proposals/[id]/approve/route.ts` moves `INTERNAL_REVIEW` → `SENT`
  (ADMIN/PROJECT_LEAD, same as the rest of this module — Leads have no record-level
  scoping the way Projects do); `app/api/proposals/[id]/decision/route.ts` records the
  client's response. A `REVISION_REQUESTED` decision automatically creates the next
  version as a new `DRAFT` in the same transaction — "a revision loop back to Create
  Proposal" — mirroring `FormulationVersion`'s versioning convention (Decision #3).
  There is no Client user account yet at the lead stage (that's only created on
  conversion), so "the client accepted" / "the client asked for changes" is always an
  Admin/Project Lead recording an offline decision, exactly like how a payment is
  "verified" by an Admin confirming an offline bank acknowledgement — never a
  client-side action. **Breaking change, done deliberately per explicit request**:
  `app/api/leads/[id]/convert/route.ts` now requires an `ACCEPTED` Proposal on the
  lead before conversion (`lib/crm/proposals.ts`'s `assertLeadHasAcceptedProposal`). A
  lead sitting at `QUALIFIED` with no Proposal (possible for any lead created before
  this branch) can no longer be converted until a Proposal is created and accepted —
  the route returns a clear `ValidationError` explaining this rather than failing
  silently, and `app/leads/[id]/page.tsx` shows the same message as a banner next to
  the (still-rendered) convert form.
- **Decision #7 — now superseded**: "records only, no stock ledger" no longer holds.
  `RawMaterial.stockOnHand` (denormalized running total) and `.reorderThreshold`
  (nullable — null means no alerting configured) plus a new `StockMovement` model (one
  signed row per change — a delivery, consumption, wastage, or correction) are added.
  `lib/inventory/stock.ts`'s `recordStockMovement` updates both inside one transaction
  and fires a company-wide notification (`lib/notifications.ts`'s new
  `notifyCompanyWide`, to every active ADMIN + NPD_EXECUTIVE — RawMaterial is a
  company-wide catalog entry, not Project-scoped, so the existing project-scoped
  `notify()` helper doesn't apply) the moment stock crosses at-or-below the threshold,
  not on every movement while already low. `app/api/raw-materials/[id]/stock/route.ts`
  is the route; `/raw-materials` shows stock on hand, a low-stock flag, and the record
  form inline. Deliberately **not** the fuller receipt/purchase-order/reservation
  system baseline §6.6 describes for Phase 2 — this is the lighter-weight version the
  user asked for, so Decision #7's *narrower* point (no full procurement/inventory
  system in MVP) still stands; only its "no ledger at all" part is superseded.
- **Decision #14 — Cost Intelligence (suggested selling price)**: `CostSheet` gains
  two nullable fields, `markupPercent` (optional user input) and
  `recommendedSellingPrice` (computed server-side from it, same pattern as
  `costPerBatch`/`costPerUnit`). `lib/costing/compute.ts`'s
  `computeCostSheetTotals` adds `recommendedSellingPrice = costPerUnit × (1 +
  markupPercent / 100)` — markup-on-cost, not margin-on-price — only when
  `markupPercent` is supplied; omitted means nothing is computed or stored, not a
  zero/null placeholder meant to look authoritative. Shown on `/cost-sheets/[id]`
  clearly labeled "Suggestion only — not an approved price," because Decision #4's
  costing formula itself still needs accountant sign-off — nothing reads this field
  automatically; no invoice or quotation amount is ever derived from it without a
  human choosing to use it.
- **Decision #15 — dedicated Client Portal page**: a new `/portal` route
  (`app/portal/page.tsx`), CLIENT-only, added to the nav (`app/components/shell.tsx`)
  as "Portal". Consolidates, grouped by project, exactly what baseline §11 already
  described as the Client's own view — status, milestones, approved
  (`CLIENT_VISIBLE`) documents, invoices — in one page instead of split across the
  dashboard's Client section and each project's own Client view. Neither of those is
  removed or changed; this is an additional, more complete summary, not a
  replacement.

## Superseding note — "Changed - Working Logic" branch, 29 Oct 2026 (second pass)

A ten-item feature pass confirmed with the user on the same day as the note above,
so it's labeled "(second pass)" to keep the two 29 Oct notes distinct. Covers Decision
#7 again (a narrower, deliberate reaffirmation — not a further reversal), the two new
Decisions #16/#17 above, and seven implementation-level changes that don't warrant
their own numbered decision (same convention the first superseding note used for
in-app notifications, COA images, etc.). Nothing here removes or changes any
behavior documented in the two notes above it — additive only.

- **Decision #7 — reaffirmed, not re-reversed**: the new spec asked for a
  `lowStockThreshold` field and said explicitly "no movement ledger/history
  required," which reads as a parallel, lighter-weight mechanism to the
  `reorderThreshold` + `StockMovement` ledger already built on this branch (first
  pass, 29 Oct 2026). **Interpretation, flagged here rather than guessed
  silently**: building a second field with the same meaning as `reorderThreshold`
  would fragment "what's the low-stock threshold for this material" into two
  places that could disagree. Nothing new was added to `prisma/schema.prisma` for
  this item — `stockOnHand`/`reorderThreshold`/`StockMovement` already fully cover
  it. What *was* added is the "simple way to adjust stockOnHand" the spec also
  asked for: `lib/inventory/stock.ts`'s `setStockOnHand` (and
  `POST /api/raw-materials/[id]/set-stock`, `app/raw-materials/set-stock-form.tsx`)
  lets someone enter the number they actually counted; it computes the delta and
  calls the existing `recordStockMovement`, so a manual count still produces a
  `StockMovement` row and still goes through the existing negative-stock guard and
  crossing-only `notifyCompanyWide` alert. The low-stock flag on
  `/raw-materials` is now a clearer "Low stock" badge (previously inline "⚠ low"
  text) per the spec's wording, with no change to when it fires.
- **Decision #16 — Client payment claims**: new `PaymentClaim` model
  (`prisma/schema.prisma`), `PaymentClaimStatus` (`PENDING`/`ACKNOWLEDGED`/
  `REJECTED`). `lib/payments/claims.ts` holds the pure decision logic;
  `POST /api/invoices/[id]/payment-claims` (Client-only, blocked on a `PAID`/
  `CANCELLED` invoice) creates the claim and notifies "company" via `notify()`;
  `POST /api/payment-claims/[id]/acknowledge` (Admin-only) creates the real,
  verified `Payment` from the claimed amount/mode/reference — `verifiedById` is set
  to the acknowledging Admin in the same write, since Acknowledge *is* the
  verification — links it back via `PaymentClaim.resultingPaymentId`, and notifies
  "client"; `POST /api/payment-claims/[id]/reject` (Admin-only) takes a reason,
  never creates a `Payment`, and notifies "client" with that reason. The existing
  Admin-only `POST /api/invoices/[id]/payments` route is completely untouched — it
  remains the only way to record a payment that didn't originate as a claim.
- **Decision #17 — MRP visibility**: `CostSheet` gains `recommendedMrp` (nullable,
  Admin-entered, unrelated to `costPerUnit`/`recommendedSellingPrice`) and
  `mrpPublishedAt` (nullable timestamp — the publish/unpublish switch, same
  null-means-off convention as `RawMaterial.reorderThreshold`).
  `PATCH /api/cost-sheets/[id]` (Admin-only, via `canManageCosting`) sets one or
  both; publishing notifies "client". `lib/costing/scope.ts`'s `canReadCosting` is
  **unmodified** — Client still cannot read a `CostSheet` at all. The client-facing
  project page (`app/projects/[id]/page.tsx`) instead runs its own separate query
  for the single published number (`recommendedMrp` where `mrpPublishedAt` is set),
  so the wall around the full cost breakdown stays exactly as it was.
- **Client-visible task tracking**: `Task` gains `assignedAt` (refreshed on every
  `assigneeId` change, including the first assignment) and `completedAt` (set on
  entering `DONE`, cleared on leaving it) — decision logic factored into
  `lib/projects/task-timestamps.ts` so it's unit-testable independent of the PATCH
  route, and wired into both the create route (`app/api/projects/[id]/tasks/route.ts`)
  and the existing update route (`app/api/tasks/[id]/route.ts`). The Client branch
  of `app/projects/[id]/page.tsx` now shows a read-only Tasks card (title, a plain-
  language status label, assignee, due date, assigned/completed dates) — no
  create/edit/reassign affordance anywhere in that branch; the write-side PATCH
  route already excludes `CLIENT` entirely (`requireRole(["ADMIN", "PROJECT_LEAD",
  "NPD_EXECUTIVE"])`), so this is a read addition only.
- **Supplier contact details**: `Supplier.contact` (one free-text field) replaced
  with `contactPersonName`/`contactPhone`. **Data migration note** for existing
  `contact` values (no automated migration script is run against production from
  here — this documents the one-time step Food Monk's DB owner should run once the
  migration lands): `UPDATE "Supplier" SET "contactPersonName" = "contact";` best-
  effort copies every existing value into the new name field (closest approximation
  to "best-effort: put the old value into contactPersonName" — these old values
  were unstructured free text that could be a name, a phone number, or both, so no
  script can split them correctly; a person should review and, where appropriate,
  move a number into `contactPhone` by hand).
- **Dashboards — active work, not just overdue**: `getProjectLeadDashboard` now
  also returns the Project Lead's active (non-`COMPLETED`/`CANCELLED`) projects
  with a task count and open-milestone count, and draft/in-review formulation
  versions across their assigned projects by *any* author (previously that list
  existed only on the NPD Executive's dashboard, filtered to that NPD's own
  authorship). `getNpdExecutiveDashboard` now also returns low-stock raw materials
  they manage (reusing item #1's crossing logic, read-only here — no new access,
  `canManageInventory` already included `NPD_EXECUTIVE`); its "active assigned
  tasks" list was already unfiltered by due date before this pass (not actually
  overdue-only, on inspection), so no change was needed there. `app/dashboard
  /page.tsx` gained new sections for both; nothing existing was removed.
- **NPD raw-material/supplier UX**: NPD Executive's "Materials" nav link
  (`app/components/shell.tsx`) already existed, unburied and plainly labeled, from
  the first pass — no change needed there. `app/raw-materials/page.tsx`'s "Unit"
  field is now a fixed dropdown (`lib/inventory/units.ts`: kg, g, l, ml, pcs, box)
  instead of free text, applied to both the raw-material form and consistently to
  the price-per-unit/stock fields, which are now `type="number" step="0.01"`
  numeric inputs instead of free text. Labels were plain-language already
  ("Price per unit", "Low stock warning at") and tightened further.
- **Bug fixes**: `app/globals.css`'s blanket `input, select, textarea { width:
  100% }` now excludes `input[type="checkbox"]`/`input[type="radio"]` (`width:
  auto`), fixing the "Primary contact" checkbox on
  `app/clients/[id]/new-contact-form.tsx` wrapping its label onto the next line.
  "Issue a credit note" on `app/invoices/[id]/invoice-actions.tsx` is relabeled
  "Reduce invoice amount (credit note)" with one line of helper text explaining it
  lowers the amount owed (billing correction/discount) and doesn't touch cash or
  payment records — no behavior change, the route and data model are untouched.
- **Client document access**: `lib/documents/scope.ts`'s `UPLOAD_TYPES_BY_ROLE`
  maps `CLIENT` to an empty array (previously `["OTHER"]`) — removing the upload
  right entirely, enforced server-side in `app/api/projects/[id]/documents/route.ts`
  (unchanged code, now simply always rejects a CLIENT upload via the existing
  `canUploadType` check) as well as hiding the upload form client-side. Everything
  else about the Documents module — Client's read access to `CLIENT_VISIBLE`
  documents — is unchanged.
- **Visual polish — client-facing views as cards**: `app/clients/[id]/page.tsx`
  and the `CLIENT` branch of `app/projects/[id]/page.tsx` now use the existing
  `fm-section-grid`/`fm-stat-row`/`glass glass-sm glass-card fm-section` classes
  already used on `app/dashboard/page.tsx`, instead of bare inline-styled
  `<ul><li>` lists. Presentation-only — no query, access rule, or data shape
  changed; the admin-facing (non-Client) branch of `app/projects/[id]/page.tsx`
  was intentionally left as-is, since the spec named only these two client-facing
  spots.
- **Category-aware stock batches (item #18)**: the user described three real
  situations in plain terms — (a) supplier-sourced materials with a decent shelf
  life, want received/used/remaining; (b) local-market materials bought fresh
  (typically 1-day shelf life), want used-vs-wasted since unsold stock can't carry
  over; (c) packaging-only stock, not a cooking ingredient, same
  received/used/remaining question. Confirmed with the user: perishables need
  real per-delivery tracking (not just a lifetime total), packaging stays on the
  same Raw Materials page as its own filterable category rather than a separate
  page, and usage/waste stays a manual log entry — no automatic deduction tied to
  production/trials.
  `RawMaterial.category` (`MaterialCategory`: `STANDARD` / `PERISHABLE` /
  `PACKAGING`, default `STANDARD` so every existing row is unaffected) and
  `RawMaterial.shelfLifeDays` (nullable) are new, additive fields. The new
  `StockBatch` model is one row per delivery — received qty, a denormalized
  running `remainingQty`, received date, optional expiry (auto-filled from
  `shelfLifeDays` for a `PERISHABLE` material, overridable per batch). Each
  logged `StockBatchMovement` is typed `USED` or `WASTED` (`lib/inventory
  /batches.ts`: `receiveBatch`, `logBatchUsage`), which is the real gap this
  closes — item #7's `StockMovement.reason` is free text, not something you can
  reliably report "how much was wasted" against.
  Deliberately does **not** touch item #7's `stockOnHand`/`StockMovement`/
  `reorderThreshold` — both `receiveBatch` and `logBatchUsage` call the existing
  `recordStockMovement` in the same transaction, so `stockOnHand` stays the one
  running total it always was and the existing low-stock alert keeps working
  unchanged. The existing "+/- adjustment" and "set current stock" forms
  (`stock-movement-form.tsx`, `set-stock-form.tsx`) are untouched; the new
  per-material "Batches" panel (`app/raw-materials/batch-panel.tsx`) is an
  additional, opt-in layer — a material that never gets a batch created for it
  behaves exactly as it did before this feature. `/raw-materials` gained a
  Category column and a `?category=` filter (plain `Link`s, same idiom as the
  rest of the app's query-param navigation — no new client-side state).
  `app/api/raw-materials/[id]/batches` (receive) and
  `app/api/raw-materials/[id]/batches/[batchId]/log` (log used/wasted) reuse
  `canManageInventory` — no new permission was needed.
  Same sandbox limitation as every other schema change on this branch (see
  `tests/setup/fakePrisma.ts`): no live Postgres reachable here, so
  `prisma migrate dev` couldn't be run — `prisma/schema.prisma` has the new
  models/fields, but the migration SQL under `prisma/migrations/` still needs
  generating once there's real DB access, exactly as already true for every
  model added since `20261028142014_fmdb` (StockMovement, Proposal,
  PaymentClaim, etc. — the migration history has been behind schema.prisma
  since the first pass, not something this change introduces). Covered by
  `tests/inventory/batches.test.ts` against the same fake-Prisma style as
  `tests/inventory/stock.test.ts`.
- **Legal/compliance pass (item #19)**: the user listed a long, generic
  SaaS-compliance checklist (cookie banners, marketing-email unsubscribe,
  subscription cancellation, refund policy, SOC2 claims, fake reviews,
  countdown timers, DPAs, sub-processor lists, uptime SLAs, and more) and
  asked that anything applicable be fixed, on a separate branch. Before
  changing anything, the codebase was actually audited (grep across
  `app/`/`lib/` for mailers, analytics/tracking SDKs, payment/subscription
  libraries, countdown/review components, SOC2/uptime language) rather than
  assuming the checklist's premise. The audit's conclusion, in full in
  `docs/compliance-audit.md`: this is an internal, invite-only B2B
  operations tool — accounts are created by an Admin
  (`app/api/users/route.ts`), there's no public signup, no marketing emails
  are sent, no third-party analytics/ad/tracking SDK is integrated, and no
  payment/subscription is processed through the app itself. Roughly two
  thirds of the checklist (cookie-consent banner, email unsubscribe,
  marketing consent, refund/cancellation/auto-renewal disclosures, fake
  reviews/countdown-timer removal, SOC2/uptime-claim removal, parental
  consent) is therefore not applicable as the app stands today — there is
  nothing to fix because the thing the item warns against isn't present.
  Saying so, with the grep evidence, was treated as more honest than adding
  compliance theater (e.g., a cookie-consent gate in front of the one
  strictly-necessary session cookie, which would only break login).
  What genuinely was missing and got built, additively, on top of
  `Changed-Working-Logic`:
  - `app/legal/privacy/page.tsx` and `app/legal/terms/page.tsx` — public,
    unauthenticated pages. Grounded in what the app actually does, not a
    generic template; `[FILL IN]` markers mark the handful of facts only
    Food Monk can supply (legal entity name, registered address, a real
    contact address, governing-law jurisdiction, the actual hosting/DB
    provider once chosen, a real retention-days number). These are a
    starting draft, not a substitute for a lawyer's review.
  - `User.policiesAcceptedAt`/`policiesVersion` (nullable, additive) plus
    `lib/legal/policy.ts`'s `CURRENT_POLICY_VERSION` — a real, timestamped,
    versioned acceptance record, not just a boolean. `app/accept-policies/`
    is the checkbox page; `/api/auth/accept-policies` records it and logs
    an audit entry. Enforced once, centrally, in
    `app/components/shell.tsx` (every protected page already renders
    through `Shell`) rather than inside `requireUser`/`requireUserOrRedirect`
    themselves — those two functions are called from dozens of existing
    routes/pages and by the full existing test suite, so changing their
    behavior was the higher-risk path for the same outcome.
  - `DataSubjectRequest` (new, additive model) — a real "request a copy of
    my data" / "delete my account" flow at `app/data-requests/` (any signed
    in user) with an Admin queue at `app/admin/data-requests/` to mark a
    request Fulfilled/Declined. Deliberately does not auto-export or
    auto-delete anything — fulfillment is a manual, audited admin action,
    consistent with this app's existing deny-by-default, no-implicit-
    automation posture (baseline §4/§7).
  - A real accessibility fix, not just a policy statement: roughly a dozen
    places used inline `color: "#777"`/`"#888"`/`"#999"` for secondary text,
    which contrast-checks to ~4.2–4.5:1 against white — under WCAG AA's
    4.5:1 for normal text. Darkened to `#5f5f5f` (~6.4:1). A `<span
    onClick>` in `app/notifications/notification-feed.tsx` (mouse-only,
    no keyboard focus or activation) was changed to a real `<button>`.
  What's intentionally left as documented follow-up rather than code, because
  it needs real business facts or a real contract, not more code: naming
  the actual hosting/DB provider and any future sub-processor, setting a
  real data-retention number, a lawyer's pass on the disclaimer/governing-law
  clauses, and Data Processing Agreements with whatever sub-processors are
  eventually chosen. See `docs/compliance-audit.md`'s "Needs a human, not
  code" section.
- **Security audit pass (item #20)**: same honest-audit approach as item
  #19 — every item on the user's checklist was actually checked against
  this codebase before anything was changed, full results in
  `docs/security-audit.md`. The headline finding is that this app already
  had a real security pass behind it (its own code comments reference an
  earlier "build brief's security checklist"): deny-by-default auth on
  every page/route (checked all of them, not a sample), record-level data
  scoping tested by `tests/*/scope.test.ts`, CSRF same-origin checks on all
  60 mutating routes, login rate-limiting with an honestly-documented
  in-memory caveat, a real CSP/HSTS/X-Frame-Options header set, bcrypt at
  cost 12, no stack traces ever returned to a client, and a clean git
  history (scanned in full, not just the current tree) with no secret ever
  committed.
  What was genuinely missing, fixed here: `poweredByHeader: false` (Next.js
  announces itself via `X-Powered-By` by default — no reason to keep that
  free framework-fingerprinting info), a disallow-all `public/robots.txt`
  (this tool should never be crawled/indexed), and a safe `npm audit fix`
  (no `--force`) that cleared every vulnerability fixable within the
  existing dependency version ranges — verified by confirming `package.json`
  itself didn't change and the full test suite still passes.
  What's flagged rather than fixed: `npm audit` still reports 18
  vulnerabilities, every one of which only clears via a major version bump
  (`zod` 3→4, `next` 14→16, `vitest` 2→5). The `zod` one is the one that
  actually matters at runtime (it validates input on every API route) — but
  Zod v4 changed parts of its API, and this sandbox has no live database or
  real dev server to verify 53 schemas still behave correctly after a major
  bump, and `tsc` can't be used as a safety net here either (pre-existing,
  unrelated errors from the Prisma-client generation limits noted in
  `tests/setup/fakePrisma.ts`). Forcing it blind inside an unrelated
  compliance/security sweep was judged a worse outcome than documenting it
  clearly as the top follow-up item, on its own branch, with real testing.
  `next`/`vitest`'s remaining flagged issues (a Server Actions DoS this app
  can't hit — no `"use server"` anywhere in the codebase — and a couple of
  build-tool-chain CVEs in `postcss`/`tinypool` that only run during
  build/test, never in front of a real user) are lower real-world priority
  for the same reason.
