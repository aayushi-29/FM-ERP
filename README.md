# Food Monk ERP

Role-based ERP for Food Monk Innovations: client relationship management, project
and task management, new product development (formulations, trials), document
management, and project-level costing/invoicing.

**Status: scaffold stage.** No auth, no modules implemented yet — see
[Build order](#build-order) below for what's next.

## Stack

- Next.js 14 (App Router) + TypeScript
- Prisma + PostgreSQL
- Private object storage for documents (provider not yet selected — see
  [`docs/decisions.md`](docs/decisions.md) #8)

This stack was chosen because the repository had no existing code to audit or
preserve at project start (confirmed empty on 2026-10-28); it's the stack the
original system-design baseline recommends for a modular-monolith MVP.

## Getting started

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum
npm run prisma:generate
npm run prisma:migrate   # creates the database tables from prisma/schema.prisma
npm run dev
```

## Project structure

```
app/              Next.js App Router pages and layouts
prisma/schema.prisma   Data model (see inline comments mapping it to decisions)
docs/decisions.md      The 12 confirmed business-rule decisions
```

## Build order

Because this repo started empty, work proceeds in dependency order rather than
around existing code:

1. **Project scaffold** (this commit) — Next.js/TypeScript/Prisma wiring, no secrets committed.
2. **Database schema & migrations** (this commit) — `prisma/schema.prisma` encodes the confirmed decisions (roles, formulation versioning, decimal money, deferred inventory).
3. **Auth & server-side RBAC** — session handling plus deny-by-default middleware and record-level scoping (client org, project assignment) on every API route, before any UI calls it.
4. **Core module APIs**, in dependency order: Users → Clients/CRM → Projects/Tasks → NPD/Formulations/Trials → Documents → Costing/Invoices. Each module ships with its own permission and integrity tests.
5. **Role dashboards & UI** — built against the real APIs above, in plain language for non-technical users.
6. **Audit trail & test suite** — audit logging wired across sensitive actions; cross-client, assignment-boundary, and cost/invoice tests from the baseline's acceptance criteria.

Security hardening (TLS/headers, CSRF protection, dependency scanning, external
pen test, DPDP Act review) happens continuously during build and as a gate
before go-live — see `docs/decisions.md` #12.

## Business rules this schema encodes

See [`docs/decisions.md`](docs/decisions.md) for the full list. In short:
exactly 4 roles (Admin, Project Lead, NPD Executive, Client), versioned and
immutable-once-approved formulations, decimal (never float) money fields, and
inventory/procurement intentionally left out of this phase.
