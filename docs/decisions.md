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
| 5 | Payment milestones | Contract-specific, configurable — not a fixed split | Accepted |
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
