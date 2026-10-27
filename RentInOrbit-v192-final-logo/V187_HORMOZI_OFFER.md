# RentInOrbit V187 — Hormozi offer + active-hours hardening

## Offer changes
- Replaced unimplemented Free / Pro / Premium merchandising with one honest pilot offer.
- Pilot promise: €0 setup, €0 monthly subscription, platform fee only when a booking earns.
- Public platform-fee percentage is loaded from the same `/api/config` value used by the server instead of being hard-coded in marketing copy.
- Added two immediate hero paths: **I want to rent** and **I want to earn**.
- Added the **RentInOrbit Promise** without claiming insurance: clear totals, availability validation, visible cancellation/deposit terms, and full rental-price refund when the supplier cancels.
- Removed unsupported “Most popular”, paid-plan feature claims and the false multi-item / one-payment claim.
- Early suppliers are explicitly offered done-for-you first-listing setup.

## Trust and conversion
- `Verified supplier` is shown only when the supplier's payout transfer capability is active.
- Instant Book is available only after payout verification; the server enforces the same rule as the UI.
- Supplier-initiated cancellation forces a full rental-price refund across supplier decline and generic cancel paths.
- Help / legal / fee copy was aligned in LT, EN, ES, DE and RU with the pilot pricing and supplier-cancellation refund rule.
- Checkout is presented as three customer-facing phases while retaining the existing internal validation screens.
- Coverage copy makes clear that RentInOrbit launches market by market and search results depend on active local supply.

## Supplier response clock
- Request-to-book suppliers can choose 2 / 4 / 8 / 24 **active hours**.
- Active hours are 08:00–22:00 in the supplier's local timezone.
- Overnight time does not count toward the response deadline and reminders are also deferred to active hours.
- Example: a 4-active-hour request created at 02:00 local starts counting at 08:00 and expires at 12:00.
- Example: a request created at 21:00 counts one hour to 22:00, pauses overnight, and uses the remaining three hours from 08:00 next day (deadline 11:00).
- Supplier timezone is stored with the listing, with country fallbacks for supported launch markets.

## Cleanup
- Removed stale Mallorca-specific demo supplier / hotel-delivery fixtures from the runtime.
- Removed retired paid-plan strings from translation dictionaries and Help Centre content.
- Retired branding remains absent from active product files.

## Verification
- `npm run check` passes.
- V187 Hormozi offer integrity test passes.
- V187 supplier active-hours clock test passes.
- Help Centre, production surface, release gate, backup launch gate, supplier onboarding, customer journey, marketplace trust, refund accounting, PWA and brand/cache regression checks pass.
- Live database / Stripe end-to-end execution still requires the deployment/runtime dependencies and credentials; static and regression checks do not substitute for a real payment sandbox run.
