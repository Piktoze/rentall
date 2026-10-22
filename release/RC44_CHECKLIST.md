# RentAll v146 / RC44 — Production Foundation

## Automated release gates

- `npm ci`
- `npm run check`
- all root `*.test.js`
- `npm run test:e2e`
- `npm run release:gate`
- `npm run audit:surface`
- `npm audit --audit-level=high`
- `npm run preflight:production`

## Production acceptance

- Invalid production configuration exits before opening the database or listening.
- Railway volume-backed SQLite initializes at migration 146 and survives restart.
- Unsupported `DATABASE_URL` values fail closed.
- `/healthz` is a liveness probe; `/api/readiness` validates configuration, database access and migration level.
- Stripe mode and public/secret keys agree; signed webhooks remain mandatory.
- Resend and the transactional outbox worker are configured and tested.
- SIGTERM stops workers, drains HTTP, checkpoints WAL and closes SQLite.
- No endpoint, log, browser asset, or report exposes secrets.

## RC44 verification — 2026-10-22

- Dependency-free root regression suite: 110/110 passed.
- Static/syntax checks: passed.
- Playwright: 11 passed; 1 live Stripe credential-gated test skipped.
- Release gate: 11/11 passed.
- Surface audit: 22/22 passed.
- Production startup smoke: passed; health/readiness 200 and migration 146.
- `npm audit`: 0 vulnerabilities.
- Empty-environment production preflight: correctly blocked before startup on all required production settings.
