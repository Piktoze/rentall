# RentAll 1.0 RC43 checklist

RC43 repairs and hardens the customer listing-to-checkout journey.

## Automated gates

- `npm run check`
- `npm run test:customer-handoff-v145`
- all dependency-free root `*.test.js`
- `npm run release:gate`
- `npm run audit:surface`

Verified for RC43: 109/109 root tests, 11/11 runnable Playwright tests, 1 Stripe credential-gated test skipped, release gate 11/11, and surface audit 22/22.

## Browser acceptance

1. Search with dates and quantity, open a listing, and confirm the same selection appears in availability.
2. Verify an unavailable range cannot continue.
3. Verify an available range opens checkout for the exact selected listing and retains dates and quantity.
4. Verify checkout performs a fresh server availability check before delivery details.
5. Complete Stripe test-mode payment, confirmation, and My Bookings on desktop and mobile.

## Environment-dependent launch gates

- Install runtime and Playwright dependencies.
- Configure the persistent production database, Stripe keys and signed webhook secret, HTTPS `APP_URL`, session secret, email provider, worker token, and support email.
- Run `npm run preflight:production`, browser RC E2E, Stripe lifecycle E2E, and production smoke checks.
