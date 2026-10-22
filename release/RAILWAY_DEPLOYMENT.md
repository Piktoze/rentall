# RentAll RC44 Railway deployment

## Service and persistent storage

1. Deploy the GitHub `main` branch as a Railway service. `railway.toml` installs production dependencies, starts `npm start`, checks `/healthz`, and restarts failed processes.
2. Attach a Railway volume at `/data`. Set `RENTALL_DB_PATH=/data/rentall.sqlite` and `RAILWAY_VOLUME_MOUNT_PATH=/data`.
3. Run `npm run db:init` once in the Railway service shell. It is safe to rerun and must report migration version 146 or newer.
4. Do not set a PostgreSQL `DATABASE_URL` in RC44. The application rejects unsupported database URLs rather than silently writing to ephemeral SQLite. A `file:` or `sqlite:///` URL is accepted only when it resolves to persistent storage.

## Required Railway Variables

Store these as Railway service variables. Never commit their values or expose them in diagnostics.

- `NODE_ENV=production`
- `APP_URL=https://<public-domain>`
- `PUBLIC_BASE_URL=https://<public-domain>`
- `SESSION_SECRET=<at-least-32-random-characters>`
- `TRUST_PROXY_HOPS=1`
- `RENTALL_DB_PATH=/data/rentall.sqlite`
- `RAILWAY_VOLUME_MOUNT_PATH=/data`
- `STRIPE_MODE=test` for staging or `live` for public payments
- `STRIPE_SECRET_KEY=<mode-matched restricted rk_ key where permissions allow>`
- `STRIPE_PUBLISHABLE_KEY=<mode-matched pk_ key>`
- `STRIPE_WEBHOOK_SECRET=<endpoint-specific whsec_ secret>`
- `STRIPE_CONNECT_V2_PROVISIONING=true` only after Accounts v2 recipient provisioning is sandbox-verified
- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY=<secret>`
- `EMAIL_FROM=RentAll <bookings@verified-domain>`
- `EMAIL_WORKER_ENABLED=true`
- `EMAIL_WORKER_TOKEN=<at-least-32-random-characters>`
- `SUPPORT_EMAIL=<monitored-address>`

Use separate Stripe sandboxes/keys/webhook endpoints for staging and production. The webhook endpoint is `POST /api/stripe/webhook`; signature verification is mandatory. Never place a Stripe secret or restricted key in frontend variables.

## Release procedure

1. Run `NODE_ENV=production npm run validate:production` with the Railway variables injected.
2. Run `npm run db:init`, then deploy one instance.
3. Confirm `/healthz` returns 200 and `/api/readiness` returns 200 without secret values.
4. Run `RENTALL_BASE_URL=https://<public-domain> npm run smoke:production`.
5. Run the Playwright suite and Stripe sandbox lifecycle before changing `STRIPE_MODE` to `live`.
6. Verify a booking email is sent and the outbox drains before public traffic.

## Restart, backup, and rollback

- SIGTERM stops expiry/email timers, drains HTTP connections for up to 10 seconds, checkpoints the SQLite WAL, and closes the database.
- Keep the Railway volume attached across deploys. Back up `/data/rentall.sqlite` with `npm run backup:db` and verify it with `npm run backup:verify` before schema-changing releases.
- Roll back application code to the previous commit without replacing the volume. Never restore an older database file over a live newer database without a tested migration/restore plan.
- If readiness fails, keep traffic closed, inspect only the reported check identifiers, and correct Railway variables. Diagnostics deliberately never return secret values.
