# RentAll production runbook — RC33

## Required before public launch
1. `NODE_ENV=production`
2. Stripe secret key + signed webhook secret in deployment secret storage.
3. Persistent database (`DATABASE_URL`) or explicitly mounted persistent `RENTALL_DB_PATH`.
4. HTTPS at the public edge.
5. Run `/api/readiness` and `/api/ops/status`; production must not return a missing Stripe/database critical check.
6. Run the browser RC suite and Stripe sandbox payment/deposit/refund lifecycle before switching to live keys.

## Optional integrations
Maps and notifications can remain in safe stub/console mode. Their absence must not make bookings or payments authoritative in the browser.

## Incident checks
- `/healthz`: process health.
- `/api/readiness`: application production contract.
- `/api/ops/status`: non-secret deployment diagnostics.
Never expose secret values in diagnostics or logs.
