# RentAll production runbook — RC44

The canonical deployment procedure is [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md).

Production starts only when HTTPS, session security, persistent storage, Stripe mode/key consistency, Connect v2, transactional email, and support configuration pass the fail-closed startup contract. Use `/healthz` for liveness and `/api/readiness` for traffic readiness. Neither endpoint exposes secret values.

Before every deployment run `npm run validate:production`, `npm run db:init`, the full regression and Playwright suites, `npm run release:gate`, `npm run audit:surface`, and `npm audit --audit-level=high`.
