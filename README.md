# VTDesk

Internal ticket management system: a React web client, an Express API on MongoDB, and a shared domain package. Runs on Bun.

## Repository layout

- `web/`: React and Vite client.
- `api/`: Express API backed by MongoDB. See `api/README.md` for data design and seeding details.
- `packages/domain/`: ticket lifecycle, permissions and SLA rules shared by web and API.

## Setup

1. Install dependencies from the repository root: `bun install`.
2. API: copy `api/.env.example` to `api/.env` and set at least `MONGODB_URI` and `MONGODB_DB_NAME`.
3. Web: copy `web/.env.example` to `web/.env.local` and fill in the Firebase web app values (optional; without them browser push is hidden).
4. Initialize indexes and demo data: `bun run db:migrate` then `bun run db:seed`.
5. Start both servers in separate terminals: `bun run dev:api` (port 3001) and `bun run dev:web` (proxies `/api` to the API).

## Push notifications (Firebase Cloud Messaging)

- API: set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` (private key with newlines escaped as `\n`) from a Firebase service account. When unset, push delivery is skipped.
- Web: set the `VITE_FIREBASE_*` variables listed in `web/.env.example`, including the web push VAPID key.
- Never commit service account JSON files; they are git-ignored.

## Tests and checks

- Tests: `bun test` from the repository root (uses in-memory stores; no external database needed).
- Lint: `bun run lint`.
- Build and typecheck: `bun run build`.

## Deployment

1. Deploy from the `production` branch.
2. Provide API environment variables: `NODE_ENV=production`, `PORT`, `MONGODB_URI`, `MONGODB_DB_NAME`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `OTP_HMAC_SECRET`, `UPLOAD_DIR` (persistent volume), and the three `FIREBASE_*` variables. In production the API refuses to start without the Resend and OTP variables.
3. Start the API with `bun run start` from `api/`. Seeding is rejected when `NODE_ENV=production`.
4. Build the client with `VITE_*` variables set at build time: `bun run build --filter web`, then serve `web/dist` as static files with `/api` routed to the API.
