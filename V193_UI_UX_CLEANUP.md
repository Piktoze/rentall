# RentInOrbit v193 — Blue brand + cleaner UX

## Visual system
- Main palette moved from green to RentInOrbit logo colors: deep navy, blue, cyan and indigo.
- Header logo enlarged and given more visual space.
- Main buttons, pills, surfaces, dashboard controls and footer aligned to the new palette.
- Persistent four-step journey strip and redundant brand-proof strip removed from normal browsing view.

## Navigation
- PWA install remains real and functional, but is moved from the primary nav into “More”.
- “More” also contains secondary actions such as notifications and saved searches.
- “My bookings” starts hidden for anonymous visitors and is shown only for authenticated users or valid guest-booking access.

## Access / information hierarchy
- Anonymous users no longer see supplier notifications, supplier availability calendar, supplier locked dashboard, or customer booking workspace.
- Supplier notifications/calendar are visible only to an authenticated supplier and only when the supplier dashboard is expanded.
- Empty booking workspaces hide post-booking command/protection panels until there is a real booking.

## Browse cleanup
- Customer geo/radius/sort/saved-search/list-map controls were moved out of the supplier listing section and into Browse.
- Advanced discovery controls are collapsed under “Filters & view”.
- Listing-creation section is supplier-only.

## Localization
- Added v193 translations for the phrases that were visibly leaking English into LT/ES/DE/RU surfaces, including supplier freshness, notifications, availability, booking empty states, More-menu actions and booking workspace copy.
- Dynamic supplier freshness and empty-booking strings now pass through the translation helper instead of being hard-coded English.

## PWA
- Real `beforeinstallprompt` flow retained.
- Service worker/cache bumped to v193 and includes the new brand/UX assets.

## Validation
- `npm run check` PASS
- `pwa.test.js` PASS
- `brand-integrity-v186.test.js` PASS
- `runtime-regression.test.js` PASS
- `dom-safety.test.js` PASS
- `public-focus-v176.test.cjs` PASS
- `customer-journey-v120.test.js` PASS
- `release/rc40-surface-audit.mjs`: 26/26 PASS
- `ux-cleanup-v193.test.js` PASS
