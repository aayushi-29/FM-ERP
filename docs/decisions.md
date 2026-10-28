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
