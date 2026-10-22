# RentAll 1.0 RC40 checklist

RC40 adds a dependency-free whole-product surface audit. It verifies that the release still contains the complete customer journey, supplier operating surfaces, critical payment/security gates and production health/readiness surfaces.

Run:
- `npm run audit:surface`
- `node release/rc-gate.js`
- all root `*.test.js`

Environment-dependent final gates before public traffic:
1. install runtime dependencies;
2. `npm run preflight:production`;
3. Playwright browser E2E on desktop + mobile;
4. Stripe sandbox: payment, processing, failure, refund, deposit authorization/capture/release;
5. configured production database persistence;
6. configured email provider if transactional delivery is enabled.
