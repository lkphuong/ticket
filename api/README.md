# VTDesk API

Express API backed by MongoDB, executed with Bun.

## Setup

1. Install dependencies from the repository root: `bun install`.
2. Copy `api/.env.example` to `api/.env` and configure `MONGODB_URI` and `MONGODB_DB_NAME` (along with `PORT` and `NODE_ENV` when necessary). The `.env` file is git-ignored. `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `OTP_HMAC_SECRET` are required in production (the API refuses to start without them); in development, codes are logged or recorded instead of emailed and hashed with a per-process random secret. Uploaded ticket attachments are written to `UPLOAD_DIR` (default `./uploads`, git-ignored); point it at a persistent volume in deployed environments.
3. If the database already holds older collections, run `bun run db:drop` (lists collections, requires typing DROP).
4. Apply index schema initialization: `bun run db:migrate` (from `api/` or the repository root; the server also ensures indexes automatically on startup).
5. Load demo master data: `bun run db:seed`.
6. Start the API server: `bun run dev` (default port 3001; the web dev server proxies `/api` requests to it).

## Collection Design & Identifiers

- **Document Identifiers**: Primary entities use UUID string identifiers for `_id`; natural keys are preserved where appropriate (such as department name and SLA priority).
- **Human-Readable Ticket Codes**: Tickets carry an allocated code: `TCK-{department prefix}-{YYMM}-{sequence}`, e.g., `TCK-CNTT-2611-001`.
- **Atomic Code Counters**: Counter state per department prefix and month period is maintained in `ticket_code_counters`, incremented atomically via MongoDB `findOneAndUpdate`.
- **Embedded Subdocuments**: Unlike relational normalization, ticket attachments, discussion comments, status change history, and assignment history are embedded directly within the parent `tickets` document. This enables atomic document writes and single-query O(1) retrievals without multi-table joins.
- **Referential Integrity & Cascading**: When departments are updated or renamed, the repository layer automatically cascades the name modification across `members`, `tickets`, and `request_templates` collections.

## Embedded Limits

Comments (500) and combined status and assignment history entries (1000) are capped per ticket. Exceeding a cap returns HTTP 422 with error `TicketLimitExceeded`.

## Email Verification

Registration emails a 6 digit code valid for 10 minutes, stored only as an HMAC-SHA256 hash on the member. Five wrong attempts invalidate the code (HTTP 423); an expired code returns 410; resending is limited to once per 60 seconds (HTTP 429 with `retryAfterSeconds` and a `Retry-After` header). Any well-formed email domain is accepted.

## Collections

- `tickets`: Ticket aggregate roots with embedded attachments, comments, status transitions, and assignment history.
- `members`: Staff and administrator profiles, credentials, department links, and the optional avatar attachment id.
- `departments`: Organization divisions and prefix codes for ticket code generation.
- `request_templates`: Predefined ticket request forms configured per department.
- `default_slas`: Standard response and resolution hour thresholds by priority tier.
- `notifications`: Personal notification records for workflow events and read indicators.
- `audit_logs`: Administrative event trail recording security and configuration modifications.
- `department_transfers`: Requests to move to another department, pending until the head of the current department approves or rejects them.
- `device_tokens`: Push notification registration tokens for web and mobile devices.
- `ticket_code_counters`: Sequence counters per department and monthly billing cycle.

## Demo Data

`bun run db:seed` seeds departments, members, request templates, default SLAs, and sample tickets.

- It is idempotent: documents that already exist are never duplicated, preserving operational data.
- `bun run db:seed -- --reset` removes existing documents from application collections first after typed confirmation (or accepts `--yes` for automation).
- Seeding is rejected when `NODE_ENV=production`.
- Every seeded account, including `admin`, uses the initial password `ticket123`.
- `bun run db:seed -- --admin-only` seeds just the `admin` account (password from `ADMIN_INITIAL_PASSWORD`, changed at first login) and default SLAs, so the admin sets up departments, members and templates. Combine with `--reset` to start from an empty database.

## Tests

`bun test` from the repository root. Tests utilize isolated in-memory stores and MongoMemoryServer instances without requiring an external database cluster.

## Deployment

Supply `MONGODB_URI`, `MONGODB_DB_NAME`, `NODE_ENV`, `PORT`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `OTP_HMAC_SECRET` and `UPLOAD_DIR` environment variables, then execute `bun run start`.
