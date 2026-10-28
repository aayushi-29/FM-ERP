# Food Monk ERP

Role-based ERP for Food Monk Innovations: client relationship management, project
and task management, new product development (formulations, trials), document
management, and project-level costing/invoicing.

_Last updated: 28 Oct 2026, 11:19 IST — pushed to confirm `aayushi-29/FM-ERP` is live._

**Status:** Auth, Users, Clients/CRM, and Projects/Tasks/Milestones are
built. NPD/Formulations, Documents, and Costing/Invoices are not yet — see
[Build order](#build-order) below.

## Stack

- Next.js 14 (App Router) + TypeScript
- Prisma + PostgreSQL
- Private object storage for documents (provider not yet selected — see
  [`docs/decisions.md`](docs/decisions.md) #8)

This stack was chosen because the repository had no existing code to audit or
preserve at project start (confirmed empty on 2026-10-28); it's the stack the
original system-design baseline recommends for a modular-monolith MVP.

## Getting started (local machine)

**Prerequisites**
- [Node.js](https://nodejs.org) 20 or later (`node -v` to check)
- [PostgreSQL](https://www.postgresql.org/download/) 14+ running locally,
  or a free cloud instance (e.g. [Neon](https://neon.tech) — see the note
  on `DIRECT_URL` below if you use a pooled provider like Neon/Supabase)
- Git

**1. Clone the repo**

```bash
git clone https://github.com/aayushi-29/FM-ERP.git
cd FM-ERP
```

**2. Install dependencies**

```bash
npm install
```

**3. Create your local database** (skip if using a cloud provider — just
grab its connection string instead)

```bash
createdb fm_erp
# or, inside psql: CREATE DATABASE fm_erp;
```

**4. Set up environment variables**

```bash
cp .env.example .env
```

Open `.env` and fill in:
- `DATABASE_URL` — your Postgres connection string, e.g.
  `postgresql://postgres:yourpassword@localhost:5432/fm_erp?schema=public`
- `DIRECT_URL` — same value as `DATABASE_URL` for plain local Postgres (no
  pooler). If you're on Neon/Supabase, use their *unpooled* connection
  string here and the pooled one for `DATABASE_URL`.
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — your first login (password:
  10+ characters). Remove both after your first successful seed, below.

**5. Generate the Prisma client and create the database tables**

```bash
npm run prisma:generate
npm run prisma:migrate
```

`prisma:migrate` will prompt you to name the migration the first time
(e.g. `init`) — that's expected.

**6. Create your first Admin login**

```bash
npm run prisma:seed
```

**7. Run the app**

```bash
npm run dev
```

Open [http://localhost:3000/login](http://localhost:3000/login) and sign in
with the `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from step 4. Then remove
those two lines from `.env` — they're only needed for that one seed run.

**Optional, before you start changing code:**

```bash
npm run lint
npm run typecheck
```

Both should be clean. If `typecheck` shows errors mentioning `Role` not
exported from `@prisma/client`, step 5 (`prisma:generate`) didn't complete —
rerun it and check for errors in its output (a bad `DATABASE_URL` is the
usual cause).

> **Note on this sandbox:** `npm run typecheck` shows a cluster of errors
> here — all trace back to one cause: this development environment's
> network policy blocks Prisma's engine-binary download, so `prisma
> generate` can't complete, `@prisma/client` has no generated types, and
> every `prisma.*` call (plus anything inferred from its results) type-checks
> as `any` under `strict` mode. All of them disappear once you run `npm run
> prisma:generate` with normal internet access (locally or in CI) — it's an
> environment limitation, not a code defect. ESLint is clean throughout.

## Project structure

```
app/              Next.js App Router pages and layouts
prisma/schema.prisma   Data model (see inline comments mapping it to decisions)
docs/decisions.md      The 12 confirmed business-rule decisions
```

## Build order

Because this repo started empty, work proceeds in dependency order rather than
around existing code:

1. **Project scaffold** — done. Next.js/TypeScript/Prisma wiring, no secrets committed.
2. **Database schema & migrations** — done. `prisma/schema.prisma` encodes the confirmed decisions (roles, formulation versioning, decimal money, deferred inventory).
3. **Auth & server-side RBAC** — done for email/password. `lib/auth/` has password hashing, DB-backed sessions (revocable — Decision #9), and `requireUser`/`requireRole`/`assertProjectAccess` helpers every route and page must call explicitly (no implicit protection via folder nesting). SSO/OAuth (Google/Microsoft for staff) is a planned follow-on, not built yet — the `Session` model and cookie-based approach were chosen so adding an OAuth provider later doesn't require a redesign.
4. **Core module APIs**, in dependency order: **Users → Clients/CRM → Projects/Tasks** (done) → NPD/Formulations/Trials → Documents → Costing/Invoices. Each module ships with its own permission and integrity tests — see "Users & CRM, as built" and "Projects, Tasks & Milestones, as built" below for what's covered so far and what's intentionally deferred.
5. **Role dashboards & UI** — built against the real APIs above, in plain language for non-technical users.
6. **Audit trail & test suite** — audit logging wired across sensitive actions; cross-client, assignment-boundary, and cost/invoice tests from the baseline's acceptance criteria.

## Users & CRM, as built

- **Users** (`/admin/users`, `app/api/users`): Admin-only, matching baseline
  §4 ("Users & settings" row — Admin manages, everyone else has no access).
  No self-registration anywhere; Admin sets a temporary password directly
  (there's no invite-email flow yet — a near-term follow-up, not this
  module). Deactivating a user, or changing their role, immediately revokes
  all their sessions. You can't deactivate or demote the last active Admin —
  a safety check against accidental lockout, not a baseline requirement.
- **Clients / CRM** (`/clients`, `app/api/clients`): follows the baseline §4
  matrix — Admin full access, Project Lead "assigned/authorized clients",
  NPD Executive and Client no access. **One interpretation worth flagging:**
  the baseline doesn't define what "assigned/authorized" means precisely.
  Here, a Project Lead sees a client organization only if they're assigned
  (via `ProjectAssignment`) to at least one project under it, and within
  that scope they can add/edit **contacts** but not rename the organization
  itself (Admin-only). This is a reasonable reading, not a confirmed
  decision like the numbered 12 — flag it if Food Monk wants it tighter or
  looser; every query runs through `lib/crm/scope.ts`, so it's a one-place
  change.
- **Leads** (the `Lead` model) exist in the schema but have no API/UI yet —
  lead capture and lead-to-client conversion naturally come after Projects
  exists (conversion creates a Project), so they're deferred to that step
  rather than built ahead of what they depend on.
- Every create/update in both modules writes an `AuditLog` row in the same
  database transaction as the change itself (baseline §7: operations that
  must succeed or fail together use one transaction) — not as a
  best-effort afterthought.

## Projects, Tasks & Milestones, as built

- **Projects** (`/projects`, `app/api/projects`): Admin-only creation,
  which also creates the lead's `ProjectAssignment` row in the same
  transaction — that row, not the `leadId` field, is what actually grants
  access, so the two can't drift apart. A Client's API response uses a
  different, narrower shape (`CLIENT_SAFE_PROJECT_SELECT` in
  `lib/projects/scope.ts`) rather than the same payload with fields
  hidden client-side — no internal scope notes, no task list.
- **Tasks**: Admin/Project Lead manage them fully. An NPD Executive can
  only move the status of a task assigned to *them*, enforced server-side
  (not just absent from their UI). Client has no access to tasks at all —
  the baseline's matrix gives them "approved fields" on projects, and
  tasks aren't one.
- **Milestones** are the one place the schema's status enum alone doesn't
  say who may move it, so `app/api/milestones/[id]/route.ts` enforces
  three separate transition rights: a Project Lead can edit and submit a
  `PENDING` milestone for approval but can't self-approve; a Client can
  decide a `SUBMITTED` milestone for their own org's project but can't
  touch a `PENDING` one; Admin can override any status at any time. Every
  client decision and admin override writes to `AuditLog`; routine
  creates/status changes go to the lighter `ProjectActivity` feed instead
  (`lib/projects/activity.ts`) so the audit log doesn't fill with
  task-dragging noise.
- **Leads → client conversion** (baseline §6.1) is still not built — it
  creates a Project, so it depended on this module existing first. It's
  the natural next small piece before NPD/Formulations.

## Auth, as built

- Email + password only, for now (decided 28 Oct 2026). No public sign-up —
  an Admin creates every account, matching baseline §4 (only Admin manages
  Users & settings). First Admin comes from `npm run prisma:seed`.
- Sessions are DB-backed (`Session` model), not JWTs, specifically so an
  offboarded user's access can be revoked immediately by deleting their
  session rows (Decision #9) — a stateless token can't be revoked that way.
- `middleware.ts` is intentionally not used for auth: Prisma needs the
  Node.js runtime, and Next.js Edge middleware can't call it directly. Every
  protected page/route calls `requireUser`/`requireRole` itself instead —
  slightly more boilerplate, but nothing is protected "by accident" either.
- Baseline security items addressed now rather than deferred to Phase 4:
  CSP + HSTS + standard security headers (`next.config.mjs`), a same-origin
  check on mutating routes (`lib/security/origin.ts`), and a login rate
  limiter (`lib/security/rate-limit.ts` — **note its production caveat**,
  it's an in-memory placeholder that needs a shared store before go-live).

Security hardening (TLS/headers, CSRF protection, dependency scanning, external
pen test, DPDP Act review) happens continuously during build and as a gate
before go-live — see `docs/decisions.md` #12.

## Business rules this schema encodes

See [`docs/decisions.md`](docs/decisions.md) for the full list. In short:
exactly 4 roles (Admin, Project Lead, NPD Executive, Client), versioned and
immutable-once-approved formulations, decimal (never float) money fields, and
inventory/procurement intentionally left out of this phase.
