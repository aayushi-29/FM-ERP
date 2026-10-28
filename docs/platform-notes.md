# Platform notes: macOS vs Windows

This project is being developed on **macOS** and will run in production on
**Windows** (the team's deployment target). The two platforms set up
PostgreSQL differently enough that a `.env` or a command that works on one
silently fails on the other — this file is the single place that tracks
every difference found so far, so whoever is on the other platform doesn't
have to rediscover it the hard way.

**Rule: whenever a Mac/Windows difference causes a bug, a confusing error,
or just "it works for me" — add a row to the table below in the same
commit as the fix.** Keep entries short and point to the detailed
walkthrough in `README.md` (`Installing PostgreSQL on macOS` /
`Installing PostgreSQL on Windows`) rather than repeating it here.

## Differences found so far

| Area | macOS (Homebrew) | Windows (EDB installer) |
|---|---|---|
| **Postgres superuser** | No password by default. `initdb` enables "trust" authentication for local connections — anyone on the machine can connect as the Postgres superuser with no password. | **Password required.** The installer prompts you to set one for the `postgres` user during setup, and every connection must supply it. |
| **Superuser username** | Your macOS username (e.g. `aryansingh`), not `postgres` — Homebrew creates the cluster owned by whoever ran `brew install`. | `postgres` — the installer always creates this exact user. |
| **`DATABASE_URL` / `DIRECT_URL`** | `postgresql://<your-mac-username>@localhost:5432/fm_erp?schema=public` — **no password segment at all.** | `postgresql://postgres:<your-password>@localhost:5432/fm_erp?schema=public` — password is required in the string. |
| **Creating the database** | `createdb fm_erp` from any terminal — works immediately, no login prompt (trust auth). | Open **SQL Shell (psql)**, press Enter through the connection prompts, enter your password, then `CREATE DATABASE fm_erp;` — `createdb` isn't usually on PATH. |
| **Starting/stopping Postgres** | `brew services start postgresql@16` (runs in the background permanently, survives restarts). | Runs as a Windows **Service** automatically after install — check `services.msc` for `postgresql-x64-<version>`, right-click to Start/Stop if needed. |
| **Copying `.env.example` to `.env`** | `cp .env.example .env` (any shell). | `copy .env.example .env` in PowerShell; `cp` only works in Git Bash. |

## Why this matters for this project specifically

The "trust" auth on macOS means **the exact connection string that works
for the Mac developer will be refused on Windows**, and vice versa — it's
not a typo or a bad password, it's a real difference in how each OS's
Postgres is configured by default. If you pull a change and the app
suddenly can't reach the database, check this table before assuming the
code broke.

This also means local dev on Mac is *not* representative of how auth
behaves in production — production Postgres (whatever host gets chosen
under Decision #8) will require a password like Windows does. Don't let
"no password needed" become a habit that leaks into how the app is coded;
nothing in the app should ever assume a passwordless connection is normal
— that's purely a local macOS default.

## See also

- `README.md` → "Installing PostgreSQL on macOS" / "Installing PostgreSQL
  on Windows" for the full step-by-step on each platform.
- `.env.example` for the current expected shape of `DATABASE_URL` /
  `DIRECT_URL`.
