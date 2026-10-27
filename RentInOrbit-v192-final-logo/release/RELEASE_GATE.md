# RentInOrbit 1.0 Release Gate

## PASS — implemented in the repository
- Authoritative server-side booking/pricing and availability controls.
- Rental payment, refund and security-deposit state handling.
- Strict Stripe webhook-to-booking binding.
- Booking expiry lifecycle and notifications.
- Customer and supplier product flows, notification center and supplier finance/inventory workspaces.
- Security headers, rate limits, upload validation, guest-link revocation and launch-readiness endpoint.
- Transactional email outbox/worker architecture.
- Browser E2E harness and Stripe lifecycle test specification.
- Request correlation/logging, graceful shutdown, backup verification and recovery runbook.

## BLOCKER — must pass before public 1.0
1. Run the browser E2E suite in an environment with Playwright + Chromium and fix every failure.
2. Run Stripe test-mode lifecycle with real test credentials/webhook delivery: payment, mismatched webhook rejection, deposit authorize/release/capture, partial/full refund, expiry.
3. Perform a real database backup **and restore drill**, not only backup creation.
4. Confirm production deployment passes `/api/launch-readiness` with `NODE_ENV=production`.
5. Test mobile Safari and Chrome on physical devices for search, listing, checkout and account flows.

## EXTERNAL — requires production services/credentials
- Domain, TLS and hosting/runtime.
- Stripe account + Connect onboarding/KYC + webhook endpoint.
- Transactional email provider and verified sender/domain.
- Durable production database/storage strategy and encrypted off-site backups.
- Object storage/CDN for uploaded listing images.
- Monitoring/error tracking/alert destination.
- Legal review: Terms, Privacy, cancellation/refund/deposit policy and market-specific tax obligations.
- Production geocoding/maps provider decision if OpenStreetMap/Leaflet usage is insufficient at scale.

## Release rule
Do not label the build `1.0.0` until every BLOCKER has evidence attached to the release. External items must either be configured or explicitly accepted as a launch risk by the operator.
