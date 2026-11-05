# VTDesk API

Express API backed by PostgreSQL through Drizzle ORM, run with Bun.

## Setup

1. Install dependencies from the repository root: `bun install`.
2. Copy `api/.env.example` to `api/.env` and fill in `DATABASE_URL` (and `PORT` or `NODE_ENV` when needed). The `.env` file is git-ignored.
3. Apply migrations: `bun run db:migrate` (the server also applies them on startup).
4. Load demo data: `bun run db:seed`.
5. Start the API: `bun run dev` (default port 3001; the web dev server proxies `/api` to it).

## Identifiers

- Every table uses a `uuid` primary key (generated with `gen_random_uuid()`); departments and default SLAs keep their natural keys.
- Tickets also carry a human readable `code` shown in screens, CSV and notifications: `TCK-{department prefix}-{YYMM}-{sequence}`, e.g. `TCK-CNTT-2611-001`.
- The prefix is stored in `departments.code_prefix` and defaults to the department initials when an administrator creates a department.
- The sequence restarts at `001` each month per receiving department and is allocated atomically from `ticket_code_counters`.
- The migrations were rewritten into a single `0000_init.sql`. A database created from an older version must be dropped and migrated again.

## Demo data

`bun run db:seed` seeds departments, members, request templates, default SLAs and sample tickets.

- It is idempotent: rows that already exist are never overwritten, so re-running it keeps live data.
- `bun run db:seed -- --reset` clears every application table first. It asks for a typed confirmation, or accepts `--yes` for scripts.
- It refuses to run when `NODE_ENV=production`.
- Every seeded account, including `admin`, uses the demo password `ticket123`. Change it before exposing the database.

## Tests

`bun test` from the repository root. Tests use in-memory stores and PGlite, never the real database.

## Deploy

Provide `DATABASE_URL`, `NODE_ENV` and `PORT` as environment variables, then run `bun run start`. Never seed a production database.
