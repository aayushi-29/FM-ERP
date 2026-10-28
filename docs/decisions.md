# Confirmed decisions — Food Monk ERP

Confirmed 28 Oct 2026. These are the business-rule gaps the original system-design
baseline flagged as "must be confirmed before implementation." Two (#7, #11) were
decided directly; the rest carry forward recommended answers accepted as the build
direction. Three (#4, #6, #12) still need a named accountant / security-legal
reviewer to confirm exact figures before launch — don't hard-code numbers for those
until that happens.

| # | Decision | Direction | Status |
|---|---|---|---|
| 1 | 4-role matrix & approval authority | Admin / Project Lead / NPD Executive / Client as defined in the baseline; final per-workflow approval authority named during build | Accepted |
| 2 | Multi-user client orgs | Yes — multiple logins per client organization, each scoped to that org only | Accepted |
| 3 | Formulation approval & reapproval | Draft / In Review / Approved / Rejected; changes to ingredients, quantities, or designated critical process fields trigger a new version + reapproval | Accepted |
| 4 | Costing formula | Ingredient cost × yield/wastage + packaging/processing/labour/testing/overhead; estimate vs. actual kept separate | **Accepted — needs accountant sign-off on exact formula/rates** |
| 5 | Payment milestones | Contract-specific, configurable — not a fixed split | **Superseded 28 Oct 2026 on the "Changed - Working Logic" branch — see note below** |
| 6 | Invoicing & GST/tax | Configurable invoice numbering; tax rules follow the accountant, never hard-coded | **Accepted — needs accountant sign-off** |
| 7 | Inventory/lot tracking in MVP | Deferred to Phase 2, per baseline §3 — supplier/material *records* only in MVP, no stock ledger | Decided |
| 8 | Hosting & file storage | Keep Next.js/Prisma/PostgreSQL; private object storage, no public file URLs; provider TBD | Accepted |
| 9 | Backup / RPO-RTO / offboarding | Starting targets: RPO ≤ 24h, RTO ≤ 8h (revisit once host is picked); immediate access revocation on offboarding | Accepted |
| 10 | WhatsApp / external accounting / client-facing AI | All deferred from MVP until a confirmed need exists | Accepted |
| 11 | Brand colour tokens | Logo-derived palette — maroon `#4A2317`, gold `#C98A1F`, terracotta `#A8441F`, cream `#FBF5E9`, ink `#2B1810` | Decided |
| 12 | Pen test & DPDP Act review | Yes, both before go-live; critical/high findings remediated first | **Accepted — needs reviewer booked** |

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
