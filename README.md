# Food Monk ERP

Role-based ERP for Food Monk Innovations: client relationship management, project
and task management, new product development (formulations, trials), document
management, and project-level costing/invoicing.

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

> **Developing on Mac, running on Windows?** See
> [`docs/platform-notes.md`](docs/platform-notes.md) — it tracks every
> macOS/Windows difference found so far (starting with database
> authentication: Homebrew's local Postgres needs no password at all, while
> Windows' installer always requires one) and is the place to add a new one
> whenever "works on my machine" turns out to be platform-specific. The
> step-by-step install instructions for each OS are still below.

## Installing PostgreSQL on Windows

1. **Download the installer** from
   [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
   → "Download the installer" (EDB's installer). Pick the latest 16.x or
   17.x build.
2. **Run the installer.** Accept the defaults except:
   - **Password** — when it asks for a password for the `postgres`
     superuser, pick one and **write it down**. You'll need it in step 4
     below.
   - **Port** — leave it at the default `5432` unless something else on
     your machine already uses that port.
   - On the "Select Components" screen, leave everything checked
     (Stack Builder isn't needed — you can skip it if prompted at the end).
3. **Confirm it installed and is running.** Open **Services** (press
   `Win + R`, type `services.msc`, Enter) and look for
   `postgresql-x64-<version>` in the list — its status should say
   "Running". If it's not running, right-click it → Start.
4. **Create the app's database.** Open **SQL Shell (psql)** from the Start
   menu (it was installed alongside Postgres). It'll prompt you for:
   ```
   Server [localhost]:     press Enter (accept default)
   Database [postgres]:    press Enter (accept default)
   Port [5432]:             press Enter (accept default)
   Username [postgres]:    press Enter (accept default)
   Password for user postgres:   <the password from step 2>
   ```
   Then at the `postgres=#` prompt, type:
   ```sql
   CREATE DATABASE fm_erp;
   ```
   You should see `CREATE DATABASE`. Type `\q` and Enter to exit.
5. **Your connection string** is now:
   ```
   postgresql://postgres:<your-password>@localhost:5432/fm_erp?schema=public
   ```
   Use this for both `DATABASE_URL` and `DIRECT_URL` in step 4 of Getting
   Started below. If your password contains `@`, `:`, `/`, or `#`,
   [URL-encode it](https://www.urlencoder.org/) or pick a password without
   those characters to keep things simple.

> **Prefer not to install Postgres locally?** Skip all of the above, sign
> up at [neon.tech](https://neon.tech) (free tier), create a project, and
> copy the connection strings it gives you straight into `.env` — Neon
> gives you a pooled one for `DATABASE_URL` and an unpooled one for
> `DIRECT_URL` directly, no extra setup.

## Installing PostgreSQL on macOS

The easiest route is [Homebrew](https://brew.sh). If you don't have it:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

1. **Install Postgres:**
   ```bash
   brew install postgresql@16
   brew services start postgresql@16
   ```
   `brew services start` sets it to run in the background automatically,
   including after a restart — no separate "start the server" step needed
   going forward.
2. **Confirm it's running:**
   ```bash
   brew services list
   ```
   You should see `postgresql@16` with status `started`.
3. **Create the app's database.** Homebrew's Postgres creates a default
   superuser matching your Mac username, with no password, so this is
   usually just:
   ```bash
   createdb fm_erp
   ```
   If that errors with `role "postgres" does not exist` or similar, use
   your own macOS username in the connection string in step 4 instead of
   `postgres` — run `whoami` to see it.
4. **Your connection string:**
   ```
   postgresql://localhost:5432/fm_erp?schema=public
   ```
   (No username/password needed for Homebrew's default local setup.) If
   you did set a password, or are using a different user, it's:
   ```
   postgresql://<user>:<password>@localhost:5432/fm_erp?schema=public
   ```
   Use this for both `DATABASE_URL` and `DIRECT_URL` in step 4 of Getting
   Started below.

**Common macOS issues**
- `command not found: brew` — install Homebrew first (command above), then
  restart your terminal.
- `command not found: createdb` / `psql` — Homebrew's Postgres binaries
  aren't on your PATH. Run `brew info postgresql@16` and follow the "Add to
  PATH" lines it prints (usually adding a line to `~/.zshrc`), then open a
  new terminal tab.
- `Error: P1001: Can't reach database server at localhost:5432` — the
  service isn't running; `brew services start postgresql@16`.
- `database "fm_erp" already exists` — fine, skip to the next step.

## Getting started (local machine)

**Prerequisites**
- [Node.js](https://nodejs.org) 20 or later (`node -v` to check)
- PostgreSQL 14+ running locally — see **Installing PostgreSQL on
  Windows** or **Installing PostgreSQL on macOS** above, whichever
  matches your machine
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

**3. Create your local database**

Already done if you followed the macOS or Windows Postgres section above.
If you're on a cloud provider instead, create a project there and grab its
connection string.

**4. Set up environment variables**

On **macOS / Linux / Git Bash**:
```bash
cp .env.example .env
```
On **Windows PowerShell** instead:
```powershell
copy .env.example .env
```

Open `.env` (in a text editor, or `nano .env` / `open -e .env` on macOS)
and fill in:
- `DATABASE_URL` and `DIRECT_URL` — both set to the connection string from
  the Postgres install section above for your OS (e.g.
  `postgresql://localhost:5432/fm_erp?schema=public` on macOS with
  Homebrew's default setup, or
  `postgresql://postgres:yourpassword@localhost:5432/fm_erp?schema=public`
  on Windows), unless you're on Neon/Supabase, in which case use their
  pooled connection string for `DATABASE_URL` and unpooled one for
  `DIRECT_URL`.
- `SEED_ADMIN_EMAIL` — already set to `admin@foodmonk.com` in
  `.env.example`; change it if you want a different address.
- `SEED_ADMIN_PASSWORD` — pick one (10+ characters). Remove both
  `SEED_ADMIN_*` lines after your first successful seed, below.

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
with the `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` from step 4 (default
`admin@foodmonk.com`). Then remove those two lines from `.env` — they're
only needed for that one seed run.

**8. Browse your data with Prisma Studio (optional)**

```bash
npm run prisma:studio
```

Opens a web UI at [http://localhost:5555](http://localhost:5555) where you
can view, filter, and edit every table — the closest thing to a "Postgres
UI" without installing a separate app like pgAdmin or TablePlus. It reads
`DATABASE_URL` from your `.env`, so no extra setup. Leave `npm run dev`
running in one terminal tab and run this in another; both can be open at
once.

**Optional, before you start changing code:**

```bash
npm run lint
npm run typecheck
```

Both should be clean. If `typecheck` shows errors mentioning `Role` not
exported from `@prisma/client`, step 5 (`prisma:generate`) didn't complete —
rerun it and check for errors in its output (a bad `DATABASE_URL` is the
usual cause).

**Common Windows issues** (see **Common macOS issues** further up for Mac)
- `'psql' is not recognized as an internal or external command` — the
  installer's bin folder (something like
  `C:\Program Files\PostgreSQL\17\bin`) wasn't added to PATH. Use **SQL
  Shell (psql)** from the Start menu instead (it works without PATH setup),
  or add that folder to your PATH and open a new terminal.
- `Error: P1001: Can't reach database server at localhost:5432` (during
  `prisma:migrate` or `npm run dev`) — Postgres isn't running. Open
  `services.msc`, find `postgresql-x64-<version>`, and start it.
- `password authentication failed for user "postgres"` — the password in
  `DATABASE_URL` doesn't match what you set in step 2 of the install.
  There's no "forgot password" for local Postgres — reinstall, or reset it
  via `ALTER USER postgres PASSWORD 'newpassword';` in SQL Shell (psql) if
  you can still log in with the old one.
- Port `5432` already in use — something else is using it (maybe an
  earlier Postgres install). Either stop that service, or install this one
  on a different port and update `DATABASE_URL`/`DIRECT_URL` to match.

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
4. **Core module APIs**, in dependency order: **Users → Clients/CRM → Projects/Tasks → NPD/Formulations/Trials → Documents → Costing/Invoices** (all done). Each module ships with its own permission and integrity tests — see "Users & CRM, as built", "Projects, Tasks & Milestones, as built", "NPD / Formulations / Trials, as built", "Documents, as built", and "Costing & Invoicing, as built" below for what's covered so far and what's intentionally deferred.
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
- **Leads** (`/leads`, `app/api/leads`) — Admin + Project Lead can both log
  and work the whole pipeline (`OPEN`/`QUALIFIED`/`LOST`); baseline §4's
  "Clients/CRM" row doesn't define a per-lead boundary (a Lead predates any
  `ClientOrganization`/`Project` for `ProjectAssignment` to scope against),
  so this is a flagged interpretation, not a confirmed decision — see the
  comment in `app/api/leads/route.ts` if Food Monk wants the pipeline split
  some other way. **Converting** a lead (`POST /api/leads/[id]/convert`,
  `/leads/[id]`'s convert form) is Admin-only, matching Project creation's
  own restriction: in one transaction it creates the `ClientOrganization`
  (named from the lead's company), a primary `ClientContact` from the
  lead's contact details, the `Project` itself, the lead's
  `ProjectAssignment` row, and marks the `Lead` `CONVERTED` with
  `convertedToProjectId` set — never partially, and never two ways to
  reach `CONVERTED` (the plain `PATCH` route explicitly rejects setting
  that status directly).
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
- **Leads → client conversion** (baseline §6.1) is built — see "Users &amp;
  CRM, as built" above; it depended on this module existing first since
  conversion creates a `Project`.
- **Due-date consistency**: a task or milestone's due date can't be set
  after its project's `targetDate` — enforced server-side in
  `lib/projects/due-date.ts`, called from both create and edit on tasks
  and milestones, and from the project's own PATCH route in the other
  direction (pulling `targetDate` earlier is rejected if a task or
  milestone is already due after the new date). Found and fixed 28 Oct
  2026 after a build-review pass surfaced it as a silent data-integrity
  gap — the date pickers also show the limit as a `max` attribute, but
  that's a convenience, not the enforcement; the API rejects it either
  way. A project with no `targetDate` set has nothing to check against.

## NPD / Formulations / Trials, as built

- **Products** (`/projects/:id/products`, `app/api/projects/[id]/products`):
  Admin and NPD Executive create them under a project the actor is
  assigned to (or any project, for Admin); Project Lead can read but not
  create (baseline §4 Formulations row: "Review/approve", not "Create").
  Client has no route here at all — unlike CRM/Projects, there's no
  reduced Client view of a product list, because the baseline gives
  Client no row for Products/Formulations, only a single approved
  formulation version's summary (see below).
- **Formulations & versions** (`/products/:id`, `/formulations/:id`,
  `/formulation-versions/:id`): creating a Formulation always creates its
  version 1 as a `DRAFT` in the same transaction — a Formulation with zero
  versions isn't a meaningful object. A `DRAFT` version's `processNotes`
  and ingredient lines can only be edited by the NPD Executive/Admin who's
  working on it; once submitted (`IN_REVIEW`) or decided
  (`APPROVED`/`REJECTED`), the version is locked — baseline §7's
  "Formulation versions are immutable after publication/approval;
  revisions create new versions" is read here to mean *every* post-draft
  status, not just Approved, since an `IN_REVIEW` version mid-decision
  shouldn't change under the reviewer either. A **Revise** action
  (`/api/formulation-versions/:id/revise`) creates version N+1 as a fresh
  `DRAFT`, copying the ingredient lines forward, rather than ever
  un-finalizing an old version — it's only offered on the latest version of
  a formulation, to avoid branching history.
- **Approvals**: Project Lead or Admin decide an `IN_REVIEW` version
  (`/api/formulation-versions/:id/approve`), writing both an `Approval` row
  and an `AuditLog` entry in the same transaction — baseline §10
  explicitly calls out approvals as needing an audit trail, so this is one
  of the few actions that write to both the audit log and the lighter
  project-activity feed.
- **Client visibility — interpretation flag:** the baseline's permission
  matrix gives Client "Approved summary only" for Formulations, while a
  separate workflow note (§6.3) describes a client-facing step that reads
  more like reviewing a document. Rather than guess which one the business
  actually wants, this build takes the matrix literally: a Client reaching
  `/formulation-versions/:id` (or the matching API route) for a version
  that isn't `APPROVED` gets a 404, and even an `APPROVED` version is
  served through `CLIENT_SAFE_VERSION_SELECT` (`lib/npd/scope.ts`) — a
  distinct Prisma `select`, not the full payload with fields hidden —
  which omits the recipe entirely (no ingredient lines, no process notes,
  no trial data). If Food Monk actually wants clients to see a prepared
  one-page summary document instead of nothing-but-metadata, that's the
  `Document` model's `FORMULATION_SUMMARY` type + `CLIENT_VISIBLE`
  visibility, which exists in the schema but has no API/UI yet (deferred
  to the Documents module, next in the build order).
- **Trials** (`/formulation-versions/:id`, `app/api/trials`): Admin has
  full access; Project Lead reads (no write — the matrix gives them no
  Trials row at all beyond "Read assigned projects"); NPD Executive can
  create trials and can only update a trial they themselves conducted,
  enforced server-side in `app/api/trials/[id]/route.ts` by comparing
  `conductedById` to the actor, not by what the UI happens to show. Client
  has no access, matching the matrix's "No access by default." **A second
  interpretation flag:** whether an NPD Executive may *see* a colleague's
  trial on a formulation version they're both working on isn't specified
  by "create/update assigned trials" — this build reads trial visibility
  as shared across everyone already permitted into the project (so a
  trial log is useful as a team record), while keeping create/update
  strictly to the conductor; see the comment above the `GET` handler in
  `app/api/formulation-versions/[id]/trials/route.ts` for how to narrow
  it if Food Monk wants trials kept private to their author.
- Every Decimal field here (ingredient quantity, percentage, trial
  quantity consumed) is validated as a plain decimal string
  (`/^\d+(\.\d+)?$/`) before it ever reaches Prisma — the same rule the
  baseline states for money (§7: "never use floating-point arithmetic for
  financial totals") applied to recipe quantities, since Costing will
  later multiply against them.

## Documents, as built

- **Upload & versioning** (`/projects/:id/documents`,
  `app/api/projects/[id]/documents`, `app/api/documents/[id]/versions`):
  every document is created with its first `DocumentVersion` in the same
  transaction, and a new version only ever adds a row — nothing is ever
  overwritten or deleted, per baseline §9 ("Preserve document versions and
  record actor, time, and relevant changes"). File bytes are written to
  disk *before* the database row is created inside the same `$transaction`
  callback, so a failed write can never leave a DB row pointing at a file
  that doesn't exist.
- **Storage is behind an interface** (`lib/storage/index.ts`), on purpose:
  the only implementation today is `lib/storage/local.ts`, which writes to
  a gitignored `storage/` folder on whatever machine is running the app.
  That's fine for development but **is not production-ready** — it isn't
  durable across redeploys and isn't shared across multiple instances.
  Decision #8's object-storage provider (still TBD) plugs in as a second
  implementation of the same two-function interface
  (`save`/`read`); nothing else in the app changes when that happens.
- **Who can upload what — interpretation flag:** the baseline's matrix
  gives NPD Executive "upload permitted technical documents" and Client
  "upload permitted types" without naming the types. This build reads
  "technical" literally (NPD Executive → `TECHNICAL_SPEC`/`TRIAL_RECORD`
  only) and keeps Client's upload right separate from the business
  document types they can only *read* (`CONTRACT`/`COMMERCIAL`/
  `FORMULATION_SUMMARY`) — Client can only upload `OTHER`, a place for
  their own reference material. Admin and Project Lead can upload any
  type, matching their "manage" language. The whole mapping is one object
  in `lib/documents/scope.ts` if Food Monk wants it widened.
- **Visibility** (`INTERNAL_ONLY` / `CLIENT_VISIBLE`) can only be set or
  changed by Admin or Project Lead (`canManageVisibility` in the same
  file) — an NPD Executive's or Client's own upload always lands
  `INTERNAL_ONLY` regardless of what they send, so nothing becomes
  client-visible without a managing role reviewing it first. A Client's
  `GET` on the list, a single document, or a download all independently
  check `visibility === CLIENT_VISIBLE` and 404 otherwise — not just a
  filtered list with an unguarded detail route behind it.
- **Downloads are authorized and audited individually**
  (`app/api/documents/[id]/versions/[versionId]/download`) — no
  public or signed URL shortcut; every request re-checks project access
  and (for Client) visibility, then streams the bytes with
  `Cache-Control: private, no-store`. Matches baseline §9/§13's explicit
  call to authorize and test file-download routes, not just uploads.
- **File validation**: a fixed MIME-type allowlist (`lib/documents/scope.ts`)
  and a 20MB size cap, both enforced server-side on every upload (initial
  and new-version). **Malware/virus scanning is not implemented** — the
  baseline asks to "consider malware scanning before making files
  available," and this MVP doesn't have a scanning provider wired in. This
  is a real gap before go-live with untrusted uploads (e.g. Client
  uploads), tracked here and in the security checklist in the build-brief
  artifact.
- **`TrialAttachment`** (linking a Document to a Trial) is built:
  `POST /api/trials/[id]/attachments` (body `{ documentId }`) and
  `DELETE /api/trial-attachments/[id]`, both following the same write rule
  as a trial's own `PATCH` — Admin always, an NPD Executive only for a
  trial they conducted. This links an *already-uploaded* project
  `Document` to a trial; it never uploads a new file itself (that's still
  the Documents module's job), and a document from a different project is
  rejected. The trial detail view (`trials-section.tsx`) lists each
  trial's attached document types with a Remove button, and a dropdown to
  attach any of the project's existing documents not already linked.
  Removing an attachment only deletes the join row, never the underlying
  `Document`.

## Costing & Invoicing, as built

- **This module needs the accountant's sign-off before it handles real
  numbers** — Decision #4 (costing formula) and Decision #6 (GST/tax,
  invoice numbering) are both explicitly unconfirmed in
  `docs/decisions.md`. What's built is the *recording structure and
  arithmetic plumbing* — every input the formula touches, stored as its
  own column, with the actual formula and numbering scheme isolated in
  one function each so the real ones drop in without touching a route.
  Treat every number this module currently produces as a placeholder for
  testing the workflow, not a real quote.
- **Cost sheets** (`/projects/:id/costing`, `app/api/projects/[id]/cost-sheets`):
  Admin-only to create (baseline §4 Costing row: "Manage" is Admin's row
  alone — Project Lead is read-only, NPD Executive and Client have none at
  all). The formula — `lib/costing/compute.ts` — is one specific,
  documented reading of Decision #4's text ("ingredient cost ×
  yield/wastage + packaging/processing/labour/testing/overhead"); the
  comment at the top of that file spells out exactly which arithmetic was
  chosen and why, so whoever confirms the real formula with the
  accountant can see precisely what to change. `costPerBatch`/`costPerUnit`
  are always computed server-side from the stored inputs — never accepted
  from the client — and a recalculation creates a new row
  (`supersedesId`) rather than overwriting the one a client may have
  already seen a price derived from.
  **Schema note**: there's no reliable per-unit raw-material price feed in
  this MVP (Decision #7 defers the inventory/pricing ledger), so
  `ingredientCost` is entered explicitly on each cost sheet rather than
  auto-summed from the recipe. `RawMaterial.defaultCostPerUnit` exists only
  as an optional reference value a future UI could use to *suggest* a
  starting number — it's never applied automatically.
- **Invoices** (`/invoices/:id`, `app/api/projects/[id]/invoices`):
  Admin-only to create or send; Project Lead and Client are read-only
  (Client additionally can't see a `DRAFT` invoice at all — an
  interpretation flag, since the matrix says "own invoices" without
  saying whether that includes drafts; see the comment on
  `isInvoiceVisibleToClient` in `lib/costing/scope.ts` to change it).
  `subtotal` and `amount` are always computed server-side from the
  posted lines plus an explicitly-entered `taxAmount` — Decision #6:
  "tax rules follow the accountant, never hard-coded," so there is no GST%
  applied anywhere in code. `invoiceNumber` comes from
  `lib/invoices/numbering.ts`, a placeholder sequence
  (`FM-<year>-<seq>`) that exists only to satisfy the one rule every real
  numbering scheme will also need (unique, assigned once, never reused) —
  the real scheme is Decision #6's to confirm.
- **Payments and credit notes**: Admin-only to record. An invoice's
  `status` (`SENT` → `PARTIALLY_PAID` → `PAID`) is always *derived* from
  summing its payments and credit notes against its amount — there is no
  route that sets `PARTIALLY_PAID`/`PAID` directly, so the status can't
  drift from the numbers that back it. "Recording" a payment and
  "verifying" it are two separate steps/routes
  (`app/api/invoices/[id]/payments` vs. `app/api/payments/[id]/verify`,
  Admin-only both) — a typo'd bank-transfer entry can sit as
  recorded-but-unverified rather than being trusted the instant it's
  typed in.
- **Expenses** (`ProjectExpense`): folded into the Costing permission row
  (the baseline has no separate "Expenses" line) — Admin creates, Admin
  and Project Lead read.
- **All money math uses `decimal.js`** (imported directly, not via
  `Prisma.Decimal`) — chosen specifically so this module's types resolve
  correctly even against this sandbox's stub Prisma client (see the "Note
  on this sandbox" earlier in this file); on your machine, with a real
  generated client, Prisma's own Decimal fields convert into it with no
  precision loss either way. Every dollar/rupee amount posted to these routes is
  still validated as a plain decimal string first, same as NPD's
  ingredient quantities.
- **Migrations: a real, Prisma-generated initial migration is committed**
  (`prisma/migrations/20261028142014_fmdb/`). This sandbox still cannot run
  the Prisma CLI under any version (5.22, 6, or 7 all fail even on a bare
  `prisma -v` — `curl -sS "$HTTPS_PROXY/__agentproxy/status"` shows a flat
  `403` on every `CONNECT` to `binaries.prisma.sh`, which every version
  needs for its native schema-engine binary, with no WASM fallback for
  that engine). An earlier revision of this file was a hand-written
  transcription of `schema.prisma`, tested against a throwaway local
  Postgres but never run through Prisma's own schema-engine diffing. It
  has since been **replaced** with the output of a real
  `npx prisma migrate dev` run on a machine that could reach the engine —
  diffed against an actual shadow database, applied, and confirmed in
  sync by Prisma itself. It was additionally re-verified here the same
  way as before (applied to a throwaway local Postgres 16 instance: 28
  tables, 12 enums, 43 foreign keys, zero errors) before being committed.
  Every environment now runs `npx prisma migrate dev` (first time, to
  apply it and generate the client) or `npx prisma migrate deploy`
  (CI/production, applies the committed history without prompting) —
  nothing hand-written remains in the migration history.

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
  **The CSP header only applies when `NODE_ENV=production`** — Next.js's
  own dev-mode Fast Refresh needs `eval()` and inline scripts, which a
  strict `script-src 'self'` blocks outright (this broke login's "Sign in"
  button entirely during local testing — the CSP error was silently
  killing every client-side event handler on the page, not just the
  script it flagged). `npm run build && npm run start` runs with the real
  production CSP in place if you want to test against it locally.

Security hardening (TLS/headers, CSRF protection, dependency scanning, external
pen test, DPDP Act review) happens continuously during build and as a gate
before go-live — see `docs/decisions.md` #12.

## Role dashboards, as built

`/dashboard` (`app/dashboard/page.tsx`) branches by `user.role` into four
read-only summaries, each backed by its own query functions in
`lib/dashboard/queries.ts`. Every query there is already scoped the same
way the rest of the app scopes that role (assigned projects for Project
Lead, `conductedById`/`assigneeId` for NPD Executive, `clientOrgId` for
Client, org-wide for Admin) — a dashboard is a summary view, not a new
access path, so nothing it shows is something that role couldn't already
reach by navigating to the underlying page.

- **Admin** — active-project count, overdue tasks/milestones, pending
  formulation approvals, overdue invoices, unverified payments.
- **Project Lead** — the same, scoped to projects they lead or are
  assigned to; "pending approvals" here means versions waiting on *their*
  sign-off.
- **NPD Executive** — their own open tasks, draft formulation versions not
  yet submitted, rejected versions needing revision, open trials.
- **Client** — their organization's projects and milestones, recent
  `CLIENT_VISIBLE` documents, open (non-`DRAFT`) invoices.

## Audit log viewer, as built

`AuditLog` rows are written throughout the app (every sensitive
create/update already calls `logAudit()` inside the same transaction as
the change — see `lib/audit.ts`), but until now there was no way to read
them back. Two additions, both Admin-only and strictly read-only, matching
baseline §10 ("Audit log: Read-only; cannot edit/delete") — neither this
route nor this page has a PATCH/DELETE, and none should ever be added:

- `GET /api/audit-log` — optional `actorId`/`targetType`/`targetId`/`action`
  filters (action matches as a substring), offset-paginated newest-first,
  50 per page.
- `/admin/audit-log` — the same filters as a plain GET form (so a filtered
  view is a shareable URL, not client-side state), with Newer/Older paging.

## Authorization test suite, as built

`vitest` was already configured (`npm test`) but had zero test files.
**Sandbox note:** this environment can't run `prisma generate` (egress to
`binaries.prisma.sh` is blocked — same root cause documented in
`lib/costing/compute.ts`'s header comment), so a real integration suite
against a live Postgres test database couldn't be exercised here. What's
built instead, under `tests/`:

- `tests/setup/fakePrisma.ts` — a small in-memory stand-in for the exact
  handful of Prisma calls the authorization helpers make (`project.findUnique`,
  `projectAssignment.findUnique`, `task.findFirst`, `milestone.findFirst`),
  wired in per test file via `vi.mock("@/lib/prisma", ...)`.
- `tests/auth/project-access.test.ts` — `assertProjectAccess` (the single
  record-level gate used everywhere a Project is touched): Admin passes
  unconditionally, a Client from one organization is blocked from another
  organization's project (**cross-client isolation**), a Project Lead/NPD
  Executive is blocked from a project they have no `ProjectAssignment` row
  for (**project-assignment boundary**), and a nonexistent project is
  rejected rather than silently passing.
- `tests/projects/due-date.test.ts` — both directions of the due-date fix
  below: a task/milestone due date can't exceed its project's target date,
  and a project's target date can't be shrunk below an already-scheduled
  task/milestone (the latter was extracted into
  `assertNoLaterDueDatesThan()` in `lib/projects/due-date.ts`, out of the
  `PATCH /api/projects/[id]` route body, specifically so it could be unit
  tested the same way).
- `tests/costing/scope.test.ts` — the full Costing/Invoices permission
  matrix as pure-function assertions (`canReadCosting`, `canManageCosting`,
  `canReadInvoices`, `canManageInvoices`, `isInvoiceVisibleToClient`):
  NPD Executive has no access to either; Client reads invoices but never
  cost sheets; only Admin manages/writes either; `DRAFT` invoices are
  hidden from Client.
- `tests/documents/scope.test.ts` — the upload-type-by-role matrix
  (`canUploadType`, `canManageVisibility`): NPD Executive limited to
  `TECHNICAL_SPEC`/`TRIAL_RECORD`, Client limited to `OTHER` only, only
  Admin/Project Lead can change a document's visibility.
- `tests/costing/compute.test.ts` — not an authorization test, but guards
  `computeCostSheetTotals`'s arithmetic (yield/wastage application, the
  zero-yield and zero-batch-size guards) against silent regressions.

Run with `npm test`. **Before going live**, point `DATABASE_URL` at a real
test database and add an integration layer on top of this (the same
boundary cases, exercised through the actual API routes and a real
Postgres instance) — these unit-level tests prove the authorization
*logic* is correct, not that every route actually calls it.

## Business rules this schema encodes

See [`docs/decisions.md`](docs/decisions.md) for the full list. In short:
exactly 4 roles (Admin, Project Lead, NPD Executive, Client), versioned and
immutable-once-approved formulations, decimal (never float) money fields, and
inventory/procurement intentionally left out of this phase.

## "Changed - Working Logic" branch additions

A later requirements pass added the following on top of everything above —
see [`docs/decisions.md`](docs/decisions.md)'s superseding note for the full
rationale, and the inline comments in the files below for the detail:

- **Fixed 60/25/15 payment stages** (`PaymentStage` on `Invoice`,
  `lib/payments/stage.ts`), replacing the old free-form per-contract split.
  An invoice can still omit a stage for anything ad-hoc.
- **Execution gate**: a project's tasks and trials can't be created until an
  Admin verifies the Payment on its 60% advance invoice
  (`Project.advancePaymentVerifiedAt`, `lib/projects/execution-gate.ts`).
  There's still no payment gateway — this is always a human confirming an
  offline/email acknowledgement.
- **In-app notifications** (`Notification` model, `lib/notifications.ts`) —
  fired on staged-invoice creation and payment verification, to the company
  side, the client side, or both. A bell in the top nav
  (`app/components/notification-bell.tsx`) polls every 30s; there is no
  email/SMS transport.
- **Supplier/raw-material UI** at `/raw-materials` (`lib/inventory/scope.ts`)
  — the `Supplier`/`RawMaterial` records already existed in the schema but
  had no routes or pages before this. Still records-only, per Decision #7 —
  no stock ledger.
- **Ingredient COA image uploads** (`RawMaterialAttachment`) — restricted to
  image MIME types only, enforced in
  `app/api/raw-materials/[id]/attachments/route.ts`.
- **Client rework requests** (`RevisionRequest`) — a Client can ask for a
  change on an **APPROVED** formulation version without mutating it; NPD/
  Admin addresses it through the existing revise flow.
- **Trial sheets** render as a table instead of a list
  (`app/formulation-versions/[id]/trials-section.tsx`) — same underlying
  create/update/attach/remove actions, unchanged.

None of this touches the schema fields, routes, or UI the rest of the app
already relied on — every change above is additive (new nullable columns,
new models, new routes) or scoped to a single route's new behavior (the
execution gate only blocks *creating* a task/trial; it doesn't block reading
or updating existing ones).
