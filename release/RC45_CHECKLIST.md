# RentAll v147 / RC45 — Railway deployment runtime

## Automated release gates

- `npm run check`
- all root `*.test.js`, including `deployment-runtime-v147.test.js`
- `npm run test:e2e`
- `npm run release:gate`
- `npm run audit:surface`
- `npm run audit:secrets`
- `npm audit --audit-level=high`
- `npm run smoke:production-startup`
- `npm run preflight:production`

## Deployment acceptance

- Railway Infrastructure as Code targets `Piktoze/rentall` `main`, one replica, and a persistent `/data` volume.
- `npm start` validates configuration and mounted storage, runs idempotent schema initialization, then listens on Railway's `PORT`.
- Production database and listing uploads both resolve inside the attached volume.
- Railway activates traffic through `/api/readiness`; `/healthz` remains a minimal liveness probe.
- Migration 147, live database access, and traffic acceptance are required for readiness.
- Stripe key mode, publishable key, webhook signing, and Connect v2 provisioning are fail-closed without exposing values.
- Resend sender/API configuration and the outbox worker token are fail-closed.
- Interrupted transactional email claims recover on restart and active delivery receives a bounded shutdown drain.
- The public smoke gate needs only the HTTPS application URL and checks all public operational surfaces for secret leakage.
- Pricing, availability, bookings, payment, deposit, payout, guest-token, and authorization state remain server-authoritative.

## External launch evidence

- [ ] Railway CLI authenticated and project linked.
- [ ] `railway config plan` reviewed with no unintended destructive changes.
- [ ] Required Railway Variables stored and the IaC plan applied.
- [ ] Stripe sandbox webhook delivered and signature/binding rejection verified.
- [ ] Resend domain verified and a real transactional booking email delivered.
- [ ] `npm run smoke:production -- https://<domain>` passed against the deployed service.

## RC45 verification — 2026-10-22

- Static/syntax checks: passed, including Railway IaC evaluation with SDK 3.16.0.
- Root regression suite: 111/111 passed.
- Playwright: 11 passed; 1 real Stripe credential-gated lifecycle test skipped.
- Release gate: 15/15 passed.
- Surface audit: 26/26 passed.
- Secret audit: 24 frontend and 4 server/deployment files passed.
- Production startup/public smoke: passed; all five surfaces returned 200, migration 147 was ready, and graceful shutdown completed.
- Local endpoint preflight: passed.
- `npm audit`: 0 vulnerabilities.
- Empty-environment production preflight: correctly blocked before startup and reported only non-secret check identifiers.
