# RentAll production runbook — RC45

The canonical deployment procedure is [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md).

Production starts only when HTTPS, session security, a mounted writable volume, persistent database/uploads, Stripe mode/key consistency, Connect v2, transactional email, and support configuration pass the fail-closed startup contract. Use `/healthz` for liveness and `/api/readiness` for Railway traffic readiness. Neither endpoint exposes secret values.

Database initialization/migration runs idempotently in `npm start` because Railway volumes are unavailable to pre-deploy containers. Before every deployment run the full regression and Playwright suites, `npm run release:gate`, `npm run audit:surface`, and `npm audit --audit-level=high`; after deployment run `npm run smoke:production -- https://<domain>`.
