# RentInOrbit Marketplace MVP

RentInOrbit marketplace MVP for renting or renting out useful items locally or while travelling.

## Included
- Mobile-first landing page
- EN/ES language switch
- Location + date search UI
- Category filtering
- Product cards
- Simple prototype cart
- Pilot supplier offer: €0/month, platform fee only when a booking earns
- Partner lead form
- Responsive design

## Open
Double-click `index.html` in a browser.

## Not yet connected
- live supplier inventory
- real checkout / Stripe Connect
- booking database
- email notifications
- authentication
- hotel / address autocomplete

## V2 added
- 5-step booking checkout
- rental dates
- hotel / delivery details
- customer details
- booking review
- payment prototype
- booking confirmation code

## V3 added
- Supplier dashboard
- Booking list with status filters
- Accept / decline / reset booking actions
- Inventory utilisation cards
- Inventory booked-unit controls
- Revenue KPI and category summary
- Demo booking creation

## V4 added
- Supplier registration MVP
- Supplier login MVP
- Separate supplier business data
- Local browser persistence via localStorage
- Protected supplier dashboard
- Account editing
- Logout
- Demo supplier account:
  - email: demo@rentinorbit.test
  - password: demo123

### Important
This is a front-end prototype only. Passwords are stored locally in the browser and are NOT production-safe.
For production use, replace with real authentication/backend (e.g. Supabase, Firebase, Auth0, Clerk or custom backend).

## V5 added
- Supplier company name and contact person
- Phone, email and address
- Multiple delivery zones
- Default delivery fee and free-delivery threshold
- Payout account holder
- Payout country
- Prototype IBAN field
- VAT / Tax ID
- Payout schedule

Security: payout/bank details in this prototype are browser-only demo data. Production should use a secure marketplace payout provider rather than storing banking data in localStorage.

## V6 added
- Supplier Payments screen
- Stripe Connect readiness / onboarding simulation
- Bank account status
- Payout schedule selector
- Estimated next payout
- Payment history table
- Booking / fee / payout filters
- Bank details shortcut
- Supplier-specific payment settings persistence

### Important
Stripe Connect in this MVP is simulated only. No real Stripe account is created and no real payments are processed.
Production implementation should use Stripe Connect onboarding, connected account IDs, secure webhooks and server-side payment logic.

## V7 — Stripe Connect test-mode integration

This version adds a real server-side Stripe Connect MVP skeleton.

### What is included
- Node/Express server
- Stripe secret key kept on server via `.env`
- Create Express connected account
- One-time Stripe Account Link for onboarding
- Return URL and refresh URL
- Live connected-account status endpoint
- Express Dashboard login-link endpoint
- Stripe Connect webhook endpoint
- `account.updated` / external account / payout / payment event handling skeleton
- UI webhook-event simulator
- Stripe status UI: not connected / needs information / restricted / active
- Dashboard button enabled after onboarding submission

### Run locally

1. Install Node.js 20+.
2. In this folder:
   `npm install`
3. Copy `.env.example` to `.env`
4. Add your Stripe TEST secret key:
   `STRIPE_SECRET_KEY=sk_test_...`
5. Start:
   `npm start`
6. Open:
   `http://localhost:4242`

### Test webhooks with Stripe CLI

Use Stripe CLI to forward events:
`stripe listen --forward-connect-to localhost:4242/api/stripe/webhook`

Copy the `whsec_...` secret printed by Stripe CLI into:
`STRIPE_WEBHOOK_SECRET=whsec_...`

Then restart the server.

### Production changes required
- Replace the in-memory supplier→Stripe account map with a real database.
- Use your database supplier ID, not the demo email-derived ID.
- Add server-side user session authentication before every Connect endpoint.
- Never allow arbitrary supplier IDs from unauthenticated requests.
- Use HTTPS.
- Configure Stripe Connect branding and platform profile.
- Store only Stripe connected account IDs; do not store bank credentials yourself.
- Implement idempotency and event persistence for webhooks.
- Verify every Stripe webhook signature.
- Choose and implement the final marketplace charge model separately.

## V8 — Stripe webhook event log

Added:
- Backend in-memory webhook event log
- Event type
- Received timestamp
- Processing status: processing / processed / failed
- Error message
- Source: Stripe / simulator / server
- Dashboard log table
- Manual refresh
- Automatic refresh after simulated events
- Failed webhook parse / signature errors are logged

Production note:
The event log is currently stored in server memory and resets when the server restarts.
In production, persist webhook events in a database with a unique Stripe event ID, processed timestamp, retry metadata and idempotency controls.

## V9 — Webhook log filters

Added filters for:
- Stripe event type
- Processing status
- From date
- To date
- Clear filters
- Filtered / total event counter

Filtering is done client-side over the latest 200 webhook log entries returned by the MVP backend.
For production, move filtering to the database/API when event volume grows.

## V10 — persistent webhook database + idempotency

Webhook events are now persisted in SQLite using `better-sqlite3`.

### Database protections
- `event_id` has a `UNIQUE` constraint.
- The first delivery inserts the Stripe event and moves it to `processing`.
- A duplicate Stripe delivery cannot insert the same `event_id`.
- Duplicate deliveries increment `attempt_count`.
- Duplicate events return HTTP 200 without running webhook side effects again.
- Successful processing marks the row `processed`.
- Processing failures mark the row `failed` with an error message.
- Failed processing returns HTTP 500 so Stripe can retry.
- Event payload JSON is persisted for audit/debugging.
- WAL mode is enabled for safer concurrent SQLite access.

### Table fields
- event_id
- event_type
- Stripe connected account
- source
- received_at
- processing_started_at
- processed_at
- status
- error_message
- payload_json
- attempt_count

### Local setup
After updating:
`npm install`

Then:
`npm start`

The database file defaults to:
`rentinorbit.sqlite`

Override with:
`DB_PATH=/path/to/rentinorbit.sqlite`

### Important production note
SQLite is appropriate for this MVP and low-volume single-server deployment.
For production scaling across multiple app instances, migrate the same schema and unique `event_id` rule to PostgreSQL or another transactional shared database.

## V11 — Global marketplace foundation

The marketplace is no longer destination-specific.

### Customer flow
- Choose language
- Choose country
- Choose city / resort
- Choose travel dates
- Browse local rental inventory
- Book from local suppliers

### Initial countries in the MVP
- Spain
- Portugal
- Greece
- Cyprus
- Italy
- France

### Initial UI languages
- English
- Spanish
- German
- French
- Italian
- Lithuanian

### Supplier profile
Suppliers now have:
- service country
- cities / resorts served
- delivery pricing
- existing account, payout and Stripe Connect settings

### Product direction
The recommended launch architecture is:
1. One global brand and website.
2. Country -> city/resort destination hierarchy.
3. Local supplier inventory attached to a destination.
4. Search results filtered to suppliers serving the selected destination.
5. Add new countries and cities without creating a new app per destination.

## V12 — Universal item rental marketplace

The product is now a general-purpose rental marketplace rather than a holiday/travel product.

### Search
- Country
- City
- Keyword
- Category
- Quantity
- Rental dates

### Account types
- Individual
- Business

Both account types can publish rental listings.

### Listing fields
- Title
- Category
- Quantity available
- Country
- City
- Daily price
- Weekly price
- Security deposit
- Pickup / delivery
- Description

### Example use case
A person in Klaipėda can list 10 folding chairs. A renter searching Klaipėda for 10 chairs can find that listing.

### Existing infrastructure retained
- Login / registration
- Protected owner dashboard
- Stripe Connect skeleton
- Payment settings
- Webhook event log
- SQLite persistence
- event_id uniqueness and webhook idempotency

## V13 — "For my trip" search mode

Added a second customer search flow next to local rentals.

### Near me
- Country
- City
- Keyword
- Category
- Quantity
- Dates

### For my trip
- Country
- City / resort
- Hotel or apartment
- Rental dates
- Quantity
- Keyword
- Category
- Delivery automatically required to the selected accommodation

Trip search only returns listings that:
- support delivery
- support hotel / apartment delivery
- match the selected city or listed delivery zone
- have sufficient quantity
- match the keyword/category filters

### Listing settings added
Owners can specify:
- hotel / apartment delivery: yes / no
- delivery zones / cities

The selected accommodation and trip criteria are stored locally in the MVP for later checkout integration.

## V14 — hotel / apartment delivery settings per listing

Each rental listing can now define:
- hotel / apartment delivery: yes / no
- served delivery zones / cities
- delivery fee
- minimum order amount
- delivery lead time
- delivery time window

These settings are displayed on rental cards and are used by the "For my trip" flow to determine whether a listing can serve the selected destination.

Example:
- Item: GoPro camera
- Served zones: Magaluf, Palma Nova
- Delivery fee: €8
- Minimum order: €20
- Lead time: same day
- Delivery window: 12:00–16:00

## V15 — automatic hotel/apartment delivery pricing

Checkout now calculates delivery automatically from the selected listing and trip destination.

### Pricing logic
For the selected rental listing, the checkout checks:
- hotel/apartment delivery enabled
- selected city / accommodation
- configured delivery zones
- listing delivery fee
- minimum order amount
- delivery lead time
- delivery time window

### Checkout behavior
- Eligible delivery fee is added to the rental subtotal.
- Final total updates automatically.
- "For my trip" city, accommodation and dates are carried into checkout.
- If the selected city is outside the owner's delivery zone, checkout is blocked.
- If the rental subtotal is below the owner's minimum delivery order, checkout is blocked.
- The review/payment screens show the calculated delivery amount.

Example:
Rental subtotal: €59
Hotel delivery fee: €8
Total: €67

If the owner only serves Magaluf and Palma Nova, a booking to Santa Ponça will be rejected before payment.

## V16 — delivery price and estimated total in search result cards

Search/listing cards now show:
- estimated rental subtotal
- delivery fee
- estimated total
- delivery eligibility / minimum-order warning

For "For my trip":
- delivery is calculated from the selected hotel/apartment and city
- owner delivery zones are checked
- minimum delivery order is enforced
- lead time is shown

For local search:
- rental estimate is shown immediately
- delivery remains marked as calculated at checkout unless trip delivery context exists

Rental estimate uses:
- daily rate for short rentals
- weekly rate for full 7-day blocks when available
- quantity multiplier

## V17 — accommodation delivery details in checkout

Added to the booking form:
- hotel / apartment name
- full address
- guest / reservation name
- room / apartment number (optional)
- delivery instructions

Examples of delivery instructions:
- leave with reception
- call on arrival
- meet in the lobby
- apartment gate code / entrance instructions

The data is:
- carried into the booking review
- stored locally in the MVP
- used together with the existing delivery-zone and price calculation

## V18 — delivery details in booking summary

The booking review now shows a dedicated delivery summary with:
- hotel / apartment name
- city / area
- full address
- room / apartment number
- contact person
- delivery window
- delivery instructions

This appears before payment so the customer can verify the handover details.

## V19 — supplier order delivery details

Supplier booking review now includes:
- hotel / apartment name
- full delivery address
- room / apartment number
- contact person
- delivery instructions
- delivery area
- rental dates
- order value
- booking status

The supplier can open a booking from the dashboard with “View” and can accept or decline directly from the detailed order view.

## V20 — delivery-focused supplier booking list

Supplier booking list now shows:
- guest
- product
- hotel / apartment
- city
- delivery date
- contact person
- booking status
- quick actions

The detailed order view remains available through the View button.

## V21 — supplier booking filters

Supplier booking list can now be filtered by:
- booking status
- city
- delivery date

Also added:
- Clear filters button
- filtered / total booking counter

## V22 — persistent supplier booking filters

Supplier booking filters now persist across:
- opening an order
- closing an order
- returning to the booking list
- page reloads in the same browser

Persisted filters:
- status
- city
- delivery date

The booking list also remembers the scroll position when opening an order.
Clear filters removes the saved filter state.

## V23 — supplier-specific booking filter persistence

Booking filters are now stored separately for each logged-in supplier.

Each supplier has their own saved:
- status filter
- city filter
- delivery date filter
- booking list scroll position

The storage key is scoped to the logged-in supplier identity, so switching accounts no longer reuses another supplier's filters.

## V24 — real quantity-aware availability calendar

Added a real backend availability model in SQLite.

### Inventory logic
Each listing has:
- total quantity
- bookings with start date
- end date
- reserved quantity
- booking status

### Double-booking protection
Availability is checked inside a SQLite transaction immediately before creating a booking.

Overlapping bookings are counted when status is:
- pending
- confirmed
- active

Cancelled/declined bookings do not block inventory.

If there are not enough units remaining, the API returns HTTP 409 and the booking is not created.

### Example
Listing total quantity: 10 chairs

Booking A:
- 1–3 June
- quantity 6

During the same dates:
- remaining quantity = 4

A second booking for 5 chairs is rejected.
A second booking for 4 chairs succeeds.

### Added API endpoints
- POST `/api/rentals/listings/sync`
- GET `/api/rentals/availability`
- GET `/api/rentals/calendar`
- POST `/api/rentals/bookings`
- POST `/api/rentals/bookings/:bookingId/status`

### UI
- "View availability" button on listing cards
- 28-day availability calendar
- Available / limited / sold-out days
- remaining quantity shown for selected search dates
- checkout rechecks availability atomically before confirming
- confirmation shows remaining quantity after booking

## V25 — complete rental lifecycle and supplier inventory calendar

### Supplier availability calendar
The supplier dashboard now includes an inventory availability calendar:
- select listing
- select date range
- booked quantity per day
- remaining quantity per day
- fully available / limited / sold-out visual states

### Booking lifecycle
Supported statuses:
- pending
- confirmed
- active
- returned
- completed
- cancelled
- declined

Inventory is blocked only by:
- pending
- confirmed
- active

Therefore:
- cancelled bookings release inventory immediately
- declined bookings do not consume inventory
- returned/completed bookings release future inventory
- invalid status transitions are rejected by the backend

Valid examples:
- pending → confirmed / declined / cancelled
- confirmed → active / cancelled
- active → returned / completed
- returned → completed

### Backend
Added:
- booking list endpoint
- lifecycle validation
- cancellation reason
- updated/cancelled/returned timestamps
- availability response after status changes

### Important
This remains an MVP architecture using SQLite and a single Node server. For multiple production server instances, migrate transactional booking inventory to a shared database such as PostgreSQL.

## V26 — live bookings connected end-to-end

The checkout booking is now persisted with the data the supplier needs:
- customer name/email/phone
- hotel/apartment
- city
- full address
- room/apartment number
- contact person
- delivery instructions
- quantity
- rental dates
- order value

New bookings start as `pending` and immediately reserve the requested inventory.

The supplier booking table now uses the real SQLite-backed bookings instead of demo booking rows.

Supplier actions:
- pending → confirmed / declined
- confirmed → active / cancelled
- active → returned / completed
- returned → completed

Inventory is automatically recalculated after every status change.

This connects:
customer checkout → inventory reservation → supplier list → order details → lifecycle status → inventory release.

## Automated availability test

After installing dependencies:

```bash
npm install
npm run test:availability
```

The test verifies:
1. 10 units exist.
2. Booking 6 leaves 4.
3. An overlapping booking for 5 is rejected.
4. An overlapping booking for 4 succeeds.
5. Availability reaches 0.
6. Cancelling the first booking releases its 6 units.

## V27 — trust, returns and cancellation layer

Added:
- Flexible / Moderate / Strict cancellation policies per listing
- automatic refund calculation
- cancellation endpoint that releases inventory
- structured return condition and return notes
- listing detail modal
- rating summary and review list
- review API after returned/completed bookings
- supplier order view shows refund and return condition

### Cancellation policies
Flexible
- full refund ≥24h before start
- 50% refund inside 24h before start
- 0 after start

Moderate
- full refund ≥72h
- 50% refund 24–72h
- 0 inside 24h

Strict
- 50% refund ≥7 days
- 0 inside 7 days

### Tests
```bash
npm run test:availability
npm run test:trust
```

## V28 — admin dashboard, moderation and disputes

Added a platform admin area with:
- total listings
- active listings
- bookings
- open disputes
- GMV
- listing moderation
- dispute management

Listing moderation states:
- active
- paused
- blocked

Supplier can open a dispute from a booking.
Admin can resolve disputes and record a resolution.

## V29 — customer My bookings

Customer can now:
- enter/reuse the email used for booking
- see all their live bookings
- see status, dates, item, delivery location, total and refund amount
- cancel pending/confirmed bookings
- receive policy-based refund calculation
- leave a review after return/completion

The customer's last booking email is remembered locally for convenience.

## V30 — listing photos, gallery and favorites

Added:
- real PNG/JPEG/WEBP upload endpoint
- up to 6 photos per listing
- first image becomes the cover image
- listing cards show cover photos
- listing detail view shows a gallery
- favorites / wishlist stored locally

Uploaded files are saved under `/uploads` by the Node server.

For production, move image storage to object storage/CDN such as S3-compatible storage and validate image dimensions/size server-side.

## V31 — backend authentication and persistent listings

This version removes a major MVP limitation.

### Server-backed accounts
Added SQLite-backed:
- users
- password hashing with Node `crypto.scrypt`
- HttpOnly session cookie
- logout/session invalidation
- roles: customer / supplier / admin
- backend authorization middleware

Seeded development accounts:
- Supplier: `demo@rentinorbit.test` / `demo123`
- Admin: `admin@rentinorbit.test` / `admin123`

Change/remove these demo credentials before any public deployment.

### Role protection
Admin API endpoints now require an authenticated admin session.
The admin panel is hidden for non-admin users.

### Persistent listings
Full listing JSON is stored in SQLite.
Supplier listing saves are persisted on the server.
Public listings are hydrated from the server at startup.

### New endpoints
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET `/api/auth/me`
- GET `/api/listings`
- GET `/api/supplier/listings`
- POST `/api/supplier/listings`
- DELETE `/api/supplier/listings/:listingId`

### Test
```bash
npm run test:auth
```

## V32 — persistent Stripe Connect and booking payments

### Persistent connected accounts
Supplier → Stripe account mapping is now stored in SQLite instead of an in-memory `Map`.
A server restart no longer forgets the connected account.

### Authenticated Connect actions
Connect account creation, onboarding link, dashboard login link and account status now require an authenticated supplier/admin session.

### Booking payment access token
Every booking receives a random payment token.
Only its SHA-256 hash is stored in SQLite.
The plain payment token is returned only when that booking is created and is required to initialize payment.

### Destination charge PaymentIntent
When Stripe is configured, the payment endpoint creates a PaymentIntent with:
- booking total
- EUR currency
- platform application fee
- transfer destination = supplier connected account
- booking/listing metadata

Default platform fee: 15%.

Configure:
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
PLATFORM_FEE_PERCENT=15
```

### Payment Element
The booking success screen initializes Stripe Payment Element and displays:
- customer total
- platform fee
- supplier share

### Webhook state
`payment_intent.succeeded` updates the booking to payment status `paid`.
`payment_intent.payment_failed` updates it to `failed`.

Note: this MVP continues the existing Express connected-account integration already present in the project. For a brand-new production Connect integration, re-evaluate Stripe's current recommended Connect account model before launch.


## V33 — stabilization, authorization and privacy audit

This release fixes accumulated issues found while auditing V1–V32.

### Critical fixes

1. **Database migration order**
   Later versions had prepared SQL statements referencing columns such as
   `refund_amount`, `payment_token_hash` and `stripe_payment_intent_id` before
   those columns were migrated. V33 moves all required migrations ahead of the
   prepared statements.

2. **Duplicate checkout handlers**
   Earlier iterations accumulated multiple submit handlers. The oldest capture
   handler could stop the newer checkout code. V33 replaces the live checkout
   form and checkout button with clean DOM clones and wires one authoritative
   reservation handler.

3. **Correct customer field IDs**
   The newer handler previously looked for `customerEmail` / `customerPhone`,
   while the actual form uses `email` / `phone`. V33 reads the real form fields.

4. **Supplier booking privacy**
   `/api/rentals/bookings` now requires supplier/admin authentication.
   Suppliers cannot request another supplier's orders by changing `ownerEmail`.

5. **Booking mutation authorization**
   Status changes and returns require the owning supplier/admin.
   Customer cancellation requires the booking access token.

6. **Customer booking privacy**
   "My bookings" no longer retrieves all reservations by email address.
   Each reservation has a high-entropy access token. Only its SHA-256 hash is
   stored server-side; the browser keeps the token for that booking.

7. **Reviews**
   Reviews require the same booking access token and are still limited to
   returned/completed bookings.

8. **Legacy branding**
   Active booking codes now use `RA-`; default database is `rentinorbit.sqlite`.

### Security boundary
The booking access token is currently stored in browser localStorage for the MVP.
For production, customer accounts or short-lived signed customer portal sessions
would be preferable, especially on shared devices.

## V34 — payment reliability, reservation expiry and real refunds

### Reservation hold
New unpaid `pending` bookings now have an expiration timestamp.
Default:
```env
BOOKING_HOLD_MINUTES=30
```

Expired unpaid reservations:
- become `expired`
- stop blocking inventory
- cannot initialize a new payment
- are shown as expired in booking data

Paid pending reservations continue to hold inventory.

### Stripe cancellation/refund
When a booking has a successful Stripe PaymentIntent:
- customer cancellation calculates the policy refund
- Stripe refund is created for that amount
- `reverse_transfer=true` reverses the proportional destination transfer
- `refund_application_fee=true` refunds the proportional application fee
- Stripe refund ID/status is stored on the booking

For an incomplete PaymentIntent, cancellation cancels the PaymentIntent where its status is cancelable.

Supplier decline uses a full refund rather than the customer's cancellation policy.

If a PaymentIntent succeeds only after the reservation hold has already expired,
the webhook automatically initiates a full refund.

Stripe reference:
- destination charge refunds debit the platform; reversing the transfer recovers funds from the connected account
- Refund API supports `reverse_transfer` and `refund_application_fee`

## V35 — in-app notifications and booking timeline

Added persistent SQLite notifications for:
- booking created
- booking status change
- payment received
- cancellation/refund
- dispute opened

Supplier dashboard:
- unread counter
- notification list
- mark-as-read

Customer secure booking view:
- event timeline for each booking

Notifications use deterministic `unique_key` values so webhook retries do not create duplicate payment notifications.

## V36 — security hardening and platform health

Added:
- Content Security Policy
- `X-Content-Type-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- removed `X-Powered-By`
- same-origin guard for state-changing browser API calls
- in-memory rate limits for login, registration, payments and uploads
- minimum 8-character password for new accounts
- authenticated supplier/admin image upload
- 8 MB decoded image limit
- sanitized final listing-card renderer
- `/api/health` endpoint
- admin Platform Health card

Production note:
The in-memory rate limiter is appropriate for a single-node MVP. For horizontally
scaled production deployment, replace it with a shared limiter (for example,
Redis-backed rate limits).

## V37 — map search, geolocation and distance filters

Added:
- List / Map result view
- Leaflet 1.9.4 map
- OpenStreetMap tiles
- browser "Use my location"
- 5 / 10 / 25 / 50 / 100 km radius filter
- distance sorting
- price sorting
- Haversine distance calculation
- exact latitude / longitude fields for supplier listings
- "Use my current location for this listing"
- city-center coordinate fallback for demo cities
- distance badge on listing cards
- map markers for rental listings

### Location privacy
Precise browser geolocation is used only after the user presses "Use my location".
The coordinates are kept in page memory for the current session unless the user
explicitly uses them while creating a supplier listing.

### Map dependency
Leaflet stable 1.9.4 is loaded from the official documented CDN pattern and
OpenStreetMap tiles are used for the MVP. For a production deployment with high
traffic, choose a production tile provider or self-host tiles according to the
provider's usage policy.


## V38 — visual design refresh

This version focuses on a more modern, cohesive marketplace feel without changing
the business logic.

### Design direction
- dark aurora theme
- glassmorphism / elevated surfaces
- less white, more premium depth
- gradient primary actions
- cohesive cards, modals and dashboard surfaces
- richer hero section and fixed background atmosphere
- improved map, tables and form styling
- stronger visual consistency across supplier/customer/admin areas

### Notes
The refresh is implemented primarily as a design-system override layer in CSS,
so the functionality from v37 remains available.


## V39 — premium UI polish and mobile app feel

Added:
- stronger typography hierarchy
- refined hero/search treatment
- micro-interactions and tactile button states
- scroll reveal animations
- sticky header visual state
- richer card hover effects
- cleaner favorites and notification emphasis
- mobile bottom navigation
- mobile-safe cart positioning
- improved mobile spacing and form presentation
- reduced-motion accessibility support

The business logic remains based on v38/v37; this is primarily an interaction and visual polish release.


## V40 — brand system, quick categories and richer states

Added:
- quick category shortcuts in the hero
- brand proof strip below the hero
- improved empty state when no rentals match
- skeleton loading cards while server listings load
- reusable toast notifications
- more cohesive RentInOrbit brand treatment
- better feedback for favorites and notification actions

This version continues the v39 visual direction while improving real product states:
loading, empty results and user feedback.


## V41 — installable PWA and first-run onboarding

Added:
- `manifest.webmanifest`
- service worker app-shell cache
- install-app prompt
- standalone mobile app metadata
- RentInOrbit SVG app icons
- first-run 3-step onboarding
- Near me / For my trip intent selection
- language and currency preferences
- mobile-friendly onboarding UI

The PWA shell caches the core frontend files. Live API data still requires the server/network.


## V42 — saved searches + PWA privacy audit

Audit fix:
- service worker no longer caches `/api/*` responses
- service worker no longer caches `/uploads/*`
- offline fallback is limited to static app-shell/navigation assets

New search UX:
- persistent account-backed saved searches
- save current city/radius/sort/mode/category
- reopen saved searches
- delete saved searches
- live result count
- mobile-friendly saved-search drawer


## V43 — listing creation pipeline audit and correctness fixes

The overnight audit found a real regression caused by feature layering:
the base listing creator inserts new listings with `unshift()`, but several later
feature handlers were modifying the final array element. In addition, some
handlers read form values only after the base handler had already reset the form.

Fixed:
- cancellation policy now attaches to the newly-created listing
- uploaded photos now attach to the newly-created listing
- latitude/longitude now attach to the newly-created listing
- delivery settings are snapshotted before form reset
- removed redundant server writes from supplemental listing handlers
- escaped title/description in listing detail view
- added server-side supplier listing validation for title, city, quantity,
  daily price and coordinates
- added regression test for the listing pipeline


## V44 — inventory authorization and booking abuse audit

A high-impact security/data-integrity issue was found in the legacy availability
sync route. It was public, so an unauthenticated caller could submit arbitrary
listing IDs and quantities and alter the inventory table used by availability.

Fixed:
- `/api/rentals/listings/sync` now requires supplier/admin authentication
- suppliers can only synchronize their own inventory; admin remains privileged
- sync uses the same server-side listing validation as normal supplier saves
- guest checkout no longer sends localStorage inventory to the server
- frontend inventory sync refuses to run for unauthenticated/customer sessions
- public booking creation is rate limited
- availability/calendar endpoints receive abuse rate limits
- booking dates use strict `YYYY-MM-DD` validation
- booking quantity is integer-bounded
- email/name/phone receive basic server-side validation
- clients can no longer choose the initial booking status; new bookings are
  always created as `pending`

## V45 — privacy-safe account booking history

Audit found that the legacy My Bookings flow queried booking history by customer
email alone. V45 removes that browser flow. Signed-in customers now use an
authenticated account endpoint whose email is taken from the session. Signed-in
booking creation also binds account identity to the session rather than trusting
a form-supplied email. Guest bookings remain accessible through their existing
secure access-token links.


## V46 — unified account + guest booking portal

Audit found that later legacy overrides still replaced the V45 account booking loader with a device-token-only implementation. V46 adds a final unified portal that merges authenticated account history with secure guest-token records, deduplicates by booking ID, and escapes booking/timeline content. Customer session ownership is now accepted by cancellation/review authorization, while guest token access remains supported. Review rating/comment validation is also hardened.


## V47 — payment operations privacy/security audit

Fixed: Stripe webhook logs are admin-only; the event simulator is admin-only and disabled by default in production; webhook log queries are bounded to 200 rows; authenticated/payment API responses use no-store/private caching; regression coverage added.

## V48 — media security
Gallery URLs/titles are sanitized, images lazy-load, uploaded image signatures are verified, and upload responses are isolated with stricter headers.


## V49 — critical runtime regression audit

The cross-version audit found two high-impact runtime regressions that static
syntax checks did not detect:

1. Later saved-search, customer-booking and supplier-sync features referenced
   `currentServerUser`, but that variable was never declared. Those code paths
   could throw `ReferenceError` in the browser.
2. Booking creation referenced `getSessionUser(req)`, but the server's actual
   session helper is `sessionUser(req)`. Booking creation could therefore fail
   at runtime even though `node --check` passed.

Fixed:
- introduced and synchronized the canonical `currentServerUser` alias
- reset it correctly on logout
- repaired booking session lookup and avoided function-name shadowing
- preserved authenticated booking identity binding
- favorite controls now expose `aria-pressed` and descriptive labels
- photo-upload errors are escaped before HTML rendering
- added a regression test specifically for unresolved cross-version symbols


## V50 — discovery integrity and motion accessibility

Audit finding:
The layered geo/listing renderer had a subtle data-flow regression. Quick-category
buttons passed a narrowed list into `renderGeoAwareListings`, but the final wrapper
computed a filtered result and then forwarded the original collection to an older
wrapper. That older wrapper recalculated discovery results and could silently
re-introduce listings outside the selected category.

Fixed:
- the final renderer now forwards the already-filtered dataset
- category, geo-radius and sort constraints remain intact through the wrapper chain
- public listing discovery receives a modest rate limit
- `prefers-reduced-motion` is respected across animations and transitions
- added a regression test for discovery-filter integrity


## V51 — residual DOM-XSS audit + live search accessibility

The audit found several older UI branches that still inserted error messages or
stored/user-controlled values directly into `innerHTML`. These were outside the
newer sanitized listing-card path.

Fixed:
- escaped Stripe/admin operational error messages
- escaped supplier notification errors
- escaped trip destination/accommodation summary fields
- escaped supplier listing IDs/titles in availability selectors
- normalized displayed supplier quantity as a number
- discovery result count now acts as a polite live region for screen readers
- added a regression test for these residual DOM sinks

## V52 — auth abuse controls + mobile accessibility
Added explicit login/register rate limits, password-manager semantics, 44px touch targets, mobile-safe form text sizing and visible keyboard focus.


## V53 — launch-readiness, monitoring privacy and middleware cleanup

Audit findings:
- v52 had duplicate rate-limit middleware on both login and registration
- public `/api/health` still reported the obsolete version `0.36.0`
- public health exposed database/Stripe configuration details that belong in admin diagnostics
- production SEO/deployment basics did not expose robots/sitemap endpoints
- reverse-proxy trust was not explicitly configurable

Fixed:
- consolidated login/register abuse protection to one intentional limiter per route
- public health is now a minimal liveness endpoint with the current app version
- detailed database/Stripe/environment diagnostics moved to admin-only `/api/admin/diagnostics`
- added `/robots.txt` and `/sitemap.xml`
- added `PUBLIC_BASE_URL`, `APP_VERSION` and bounded `TRUST_PROXY_HOPS` deployment configuration
- added regression coverage for launch-readiness behavior

Production note:
Set `PUBLIC_BASE_URL` to the real HTTPS domain and `TRUST_PROXY_HOPS` to the exact
number of reverse proxies/load balancers in front of Node. Keep it `0` when Node
is directly exposed. This avoids trusting spoofed forwarding headers.


## V54 — transactional email foundation

Audit priority:
The marketplace had in-app notifications, but no durable transactional-email
path for booking confirmations. A production marketplace must not depend on a
browser session to tell customers that a booking was received.

Implemented:
- durable SQLite `email_outbox` queue with indexes and bounded admin inspection
- booking creation queues a `booking_received` transactional message when a
  valid customer email exists
- booking success does not fail if the email queue itself encounters an error
- admin-only `/api/admin/email-outbox` operational endpoint
- safe `/api/runtime-config` reports only boolean integration readiness, never
  provider secrets
- `.env.example` documents `EMAIL_PROVIDER`, `EMAIL_FROM`, `SUPPORT_EMAIL` and
  `EMAIL_DELIVERY_MODE`
- added regression coverage for email production readiness

Production requirement:
Connect a transactional email worker/provider (for example SES, Postmark,
Resend, SendGrid or equivalent) that claims `pending` `email_outbox` rows,
renders approved templates, sends from the verified `EMAIL_FROM` domain, and
updates delivery status/attempts. Provider credentials must remain server-side.


## V55 — reliable transactional email delivery protocol

Audit finding:
V54 could durably enqueue booking emails, but it did not yet provide a safe
claim/acknowledge/retry protocol for a production delivery worker.

Implemented:
- transactional claim moves rows from `pending` to `sending` under a DB transaction
- concurrent workers cannot successfully claim the same pending row
- successful sends are acknowledged as `sent`
- failed sends return to `pending` until `EMAIL_MAX_ATTEMPTS`, then become `failed`
- internal worker endpoints use a dedicated bearer token and timing-safe comparison
- worker endpoints are `no-store` and separate from customer/admin authentication
- exact production settings documented in `.env.example`

Production requirement:
Run a small server-side worker that calls the claim endpoint, renders the named
template, sends through the configured email provider, then calls `sent` or
`failed`. Generate `EMAIL_WORKER_TOKEN` as a long random secret and never expose
it to browser code.


## V56 — customer demo direction merged into the live marketplace

Audit priority:
The standalone customer demo established a clearer visual/product direction, but
the production MVP still needed that direction applied without throwing away
its existing booking, supplier and security logic.

Implemented as a progressive enhancement layer:
- clearer customer trust promise above the marketplace experience
- mobile search semantics and search-keyboard behavior
- date controls cannot silently default to past rental dates
- accessible keyboard treatment for dynamically rendered listing cards
- mobile filter disclosure reduces filter clutter on small screens
- dynamically loaded listings inherit the same accessibility treatment
- reduced-motion behavior retained
- visual tokens move the live UI toward the approved dark-green/lime demo system

This layer intentionally preserves the existing API/data-flow implementation.
Future versions can progressively replace legacy presentation components while
keeping booking/payment/supplier behavior stable.


## V57 — duplicate-booking protection
Adds durable Idempotency-Key handling so mobile retries/double taps cannot safely reuse the same key for different booking data, and completed responses can be replayed. Production checkout clients should generate one strong random key per booking attempt and propagate the same action identity to the payment provider.


## V58 — booking integrity audit and live idempotency integration

Audit found and fixed a critical V57 regression in the real booking route:
`customerPhone` had accidentally been assigned the accommodation name. The
booking payload mapping is restored.

The previously prepared idempotency layer is now attached to the actual
`POST /api/rentals/bookings` route. Customer-side booking helpers generate a
fresh strong `Idempotency-Key` for each intentional booking submission, while
network retries of the same request can be replayed safely by the server.

This closes the gap between the V57 infrastructure and the live booking flow
and adds a regression test specifically covering the route attachment and
customer-data mapping.


## V59 — resilient checkout retries

Audit found a remaining duplicate-booking edge case: V58 generated a fresh
idempotency key whenever request options were reconstructed. V59 keeps one key
for the whole checkout attempt, adds reusable double-submit locks with
`aria-busy`, and detects a concurrent retry of the same request. While the first
request is still processing the API returns a retryable HTTP 409 plus
`Retry-After: 2`; after completion, the stored response can be replayed.


## V60 — live checkout lock lifecycle

Audit found that V59 defined double-submit protection but the live checkout did
not invoke it. V60 connects the lock to the real checkout, releases it on every
validation/error path, closes the action identity after success, and rotates the
idempotency identity when dates, quantity or delivery details are materially
changed between attempts. This makes the visible customer flow match the server
idempotency guarantees.


## V61 — safe automatic booking retry

Audit found that the server's V59/V60 idempotency protocol exposed
`retryable` and `Retry-After`, but the browser API helper discarded both. A
customer could therefore see a generic booking failure while the original
request was still finishing.

V61 preserves HTTP status/retry metadata and adds a narrowly scoped automatic
retry for the explicit `409 + retryable` in-progress booking state. The retry
reuses the exact same request options and Idempotency-Key, waits for the
server-provided delay (bounded to 0.5–5 seconds), and retries only once. Other
errors are never retried automatically.

This turns ambiguous mobile double-submit/network timing into a clean customer
experience without weakening duplicate-booking protection.


## V62 — trustworthy live availability

Audit found that the public live-availability endpoints accepted unbounded date
ranges and quantities and did not explicitly prevent browser/proxy caching.
For a rental marketplace, stale availability can show inventory that has
already been reserved.

V62:
- validates real ISO calendar dates
- rejects reversed/zero-length rental windows
- bounds normal availability queries to 366 days
- bounds detailed calendar queries to 93 days
- requires quantity to be an integer from 1–999
- marks availability and calendar responses `no-store`
- adds a regression test covering these launch-critical guarantees

These controls reduce accidental load amplification and ensure discovery and
checkout do not rely on cached inventory snapshots.


## V63 — idempotency lifecycle recovery + booking rule consistency

Audit found a launch-critical edge case: if a booking request acquired an
idempotency key and then ended in validation, availability or server error, its
database row remained `processing`. Retrying that same customer action could
then receive “already processing” indefinitely.

V63:
- releases unfinished idempotency records on non-success responses
- cleans up an unfinished action if the connection closes before a response
- only deletes rows still marked `processing`; completed booking responses stay replayable
- makes booking creation reuse the same authoritative date-window and quantity
  validation as live availability
- removes the old booking quantity limit mismatch (1000 vs availability 999)
- therefore booking and availability now agree on date validity, maximum rental
  window and quantity rules

This closes a recovery failure in the checkout path and removes duplicated
validation logic that could drift again.


## V64 — authoritative price/payment integrity
Audit found a critical issue: the browser supplied `orderValue`, booking stored it,
and Stripe later charged that stored amount. V64 calculates the payable rental
total on the server from trusted listing prices, validated duration and quantity.
Weekly pricing is applied when cheaper; configured delivery fee/minimum and
delivery eligibility are enforced server-side. Client `orderValue` is no longer
authoritative. The visible checkout estimate now also includes duration and
quantity. Booking notifications use effective authenticated customer identity.


## V65 — pricing source regression fix

The V64 follow-up audit caught a critical regression before launch: the new
authoritative server price calculator was fed by `getRentalListing()`, which is
the intentionally thin inventory table (id, owner, title, quantity) and does
not contain `priceDay`, `priceWeek` or delivery pricing. That could make valid
bookings fail with “Listing has no valid daily price”.

V65 adds a direct full-listing lookup from `rental_listing_details` and uses it
for authoritative booking pricing and fulfillment rules, while retaining the
inventory row for atomic availability. Blocked listings are also rejected at
booking time. Supplier notifications reuse the same full listing instead of
performing another thin lookup.


## V66 — booking date safety
The shared live-availability/booking validator now rejects rental starts before
the current UTC calendar day and starts beyond a two-year planning horizon.
Existing real-date, end-after-start and maximum-window rules remain in force.
This prevents direct API clients from creating historical or operationally
meaningless future reservations.


## V67 — transparent checkout pricing
Checkout now explains the live amount before submission: rental duration,
quantity, rental subtotal, delivery when applicable and estimated total. The
breakdown is wired to the existing checkout total refresh rather than creating a
second pricing flow, and it uses an `aria-live` region so price changes are
announced to assistive technology. The server remains the authoritative final
price source before booking creation.


## V68 — durable booking confirmation

Audit found that successful checkout still lacked a clear, scannable confirmation
state. V68 adds a post-booking confirmation card sourced from the server response,
showing the booking reference, dates, quantity and server-verified total plus the
next step (supplier notification / My bookings). The confirmation is announced
with `aria-live`, is mobile responsive and respects reduced-motion preferences.
No client-supplied price is used as the trusted confirmation amount.


## V69 — actionable booking confirmation

Audit found that V68 told customers to use “My bookings” but did not provide a
direct action. V69 adds an explicit View my bookings button after successful
checkout. Guest bookings additionally get a Copy secure booking link action,
created only after the customer explicitly requests it and only when the server
returned a guest access token. Copy success/failure is announced accessibly.
Actions use mobile-safe 44px touch targets.


## V70 — booking confirmation email
Booking confirmation is now queued immediately after successful booking creation,
with server-authoritative pricing, dates, quantity, fulfillment and a secure
booking destination. Guest customers receive their tokenized booking URL;
signed-in customers receive the account booking destination. A RentInOrbit HTML
email template and admin-only no-store preview endpoint are included.

Audit also removed an older malformed email enqueue accidentally nested inside
Stripe webhook handling. Actual internet delivery still requires the configured
production email worker/provider; queued mail is not falsely marked delivered.


## V71 — booking status emails
Customer email flow now continues after the initial booking receipt. When a
supplier/admin successfully changes a booking status, RentInOrbit queues a matching
status email. Confirmed bookings receive “Booking confirmed”; supplier declines
receive “Booking declined” after the refund/status workflow completes. Each
message includes a secure View booking destination. Admin email preview now
supports all `booking_*` templates. Provider delivery remains an external
production configuration requirement.


## V72 — idempotent customer email delivery queue
Audit found that repeated supplier/admin status requests could enqueue duplicate
customer emails. The durable outbox now has a backward-compatible `dedupe_key`
migration and partial unique index. Transactional enqueue uses INSERT OR IGNORE
and returns the existing message id when the same event is queued again.

Initial booking receipts dedupe by booking id; status emails dedupe by booking id
plus status. This prevents customers from receiving repeated confirmation or
decline emails when an API request is retried, while preserving worker retry
behavior for genuinely failed deliveries.


## V73 — deep guest-link integrity audit
A critical cross-layer mismatch was found: atomic booking creation returns the
raw guest/payment token as `result.paymentToken`, but V70 email code looked for
`result.booking.accessToken`. Persisted booking rows intentionally contain only
the SHA-256 token hash. Guest receipt emails therefore missed their secure link.

V73 uses the actual returned token for the initial secure guest URL while
preserving hashed-at-rest storage. V71's later status-email path also incorrectly
assumed a raw token was persisted; that assumption is removed. Status emails no
longer fabricate a guest URL and instead direct guest customers to the secure
link in their original booking receipt.


## V74 — full reliability and abuse-resistance audit
A fresh route/database/client audit found a crash-recovery hole in booking
idempotency: if the process died after claiming an idempotency key, that key
could remain `processing` forever. V74 safely reclaims same-hash processing keys
after 10 minutes while preserving conflict/replay behavior.

Public token-authorized mutation routes for booking cancellation, review creation
and dispute creation now have endpoint rate limits. Dispute reason/details are
trimmed and bounded before persistence/notification (500 / 5000 characters),
preventing unbounded payloads and UI/database abuse.


## V75 — payment boundary hardening
A fresh payment-flow audit found two launch-critical boundary issues. Production
Stripe webhooks could fall back to parsing unsigned JSON when the webhook secret
was missing; production now fails closed until `STRIPE_WEBHOOK_SECRET` is set.

When an existing Stripe PaymentIntent is reused, RentInOrbit now verifies its
booking metadata, authoritative amount and EUR currency before returning its
client secret, and rejects cancelled intents. Production payment errors are
sanitized instead of returning raw provider/internal messages.


## V76 — guest access lifecycle and account booking detail
Guest booking links previously had no revocation lifecycle: the token hash was
secure at rest, but a leaked URL could remain usable indefinitely. V76 adds a
backward-compatible guest-access revocation timestamp, rejects revoked tokens,
and provides a protected endpoint for the booking owner/supplier/admin to revoke
a guest link.

The customer booking-detail route now also recognizes the signed-in booking
owner, so account customers no longer need a guest token to open their own
booking. Booking detail responses are explicitly private/no-store.


## V77 — return lifecycle hardening
Return condition is restricted to good/damaged/missing, notes are bounded, the protected return endpoint is rate-limited, and successful returns notify both customer and supplier.


## V78 — review integrity and public-content hardening
Review creation now uses cryptographic UUID identifiers instead of Math.random.
A second review for the same booking is handled as an explicit 409
`REVIEW_ALREADY_EXISTS` conflict rather than leaking a SQLite constraint error.
Missing bookings map to 404 and unknown persistence errors are sanitized.

Review comments are trimmed, length-bounded and reject unsupported control
characters before becoming public marketplace content.


## V79 — dispute and moderation lifecycle integrity
Dispute and moderation audit identifiers now use cryptographic UUIDs. RentInOrbit
prevents multiple simultaneous open disputes for one booking and prevents an
already-resolved dispute from being silently resolved again. Admin resolutions
must contain 1–5000 characters and the resolution endpoint is rate-limited.
API conflicts are returned as explicit 409 responses where appropriate.


## V80 — moderation enforcement at booking boundary
Paused/blocked listings are now unbookable even by direct known listing ID. Moderation state is enforced in availability and re-checked inside atomic booking, closing a discovery-to-checkout race/bypass.


## V81 — secure booking deep-link routing
A customer-flow audit confirmed that RentInOrbit generated guest links such as
`?booking=...&access=...`, but the application had no canonical startup router
that consumed those parameters. The links could therefore open the homepage
without opening the booking.

V81 validates the guest link against the booking API, stores the credential in
the existing per-booking access store, opens My Bookings, and immediately
removes the secret token from the visible URL/history. `?view=my-bookings` now
also opens the account booking portal as intended.


## V82 — supplier booking email delivery
New booking creation now queues a deduplicated supplier email as well as the customer receipt. It contains the booking reference, item, dates, quantity, customer display name, authoritative total and supplier dashboard link, without exposing the guest access token. Admin email preview supports the new template.


## V83 — supplier email deep-link completion
V82 introduced `?view=supplier-bookings` in supplier emails, but the customer
deep-link router did not yet consume that route. V83 closes the loop: it refreshes
the server session, requires a supplier/admin session, refreshes live bookings,
moves focus to booking management, and removes the route parameter after a
successful open. Signed-out users get explicit sign-in guidance without losing
the route prematurely.


## V84 — payment/refund race hardening
A payment-state audit found two concurrency risks. Concurrent payment setup
requests could create multiple Stripe PaymentIntents before the first ID reached
SQLite, and a delayed `payment_intent.succeeded` webhook only auto-refunded an
expired booking—not a booking already cancelled or declined.

PaymentIntent creation now uses a deterministic Stripe idempotency key.
Cancellation refunds have a persisted refund guard plus deterministic Stripe
idempotency. Late successful payments for expired, cancelled or declined
bookings are automatically fully refunded with their own idempotency key.


## V85 — truthful late-payment notifications
V84 correctly refunded Stripe payments that arrived after a booking had already
expired, been cancelled or been declined, but the webhook then continued into
the normal `payment.paid` notification path. That could tell both parties that
payment was received even though it had just been automatically refunded.

The webhook now tracks the terminal-refund outcome and emits explicit
`payment.refunded` notifications to customer and supplier instead. Normal
successful payments retain the existing `payment.paid` notifications.


## V86 — webhook ordering and payment-failure UX
Stripe webhook events are not guaranteed to arrive in a business-friendly
order. A delayed `payment_intent.payment_failed` event could previously replace
a booking's already-paid state with `failed`. V86 refuses to downgrade paid or
refunded bookings when a stale failure event arrives, and a succeeded event no
longer overwrites an already-recorded refund state.

For genuine payment failures, the customer now receives a deduplicated in-app
notification explaining that payment failed and can be retried while the
reservation remains open.


## V87 — post-rental review UX
The backend review rules were already hardened, but the final customer UI still
used blocking browser alerts and retained stale form state. V87 resets the
review form for each booking, opens the modal with correct accessibility state,
moves keyboard focus to the rating control, uses non-blocking success/error
feedback, handles an already-reviewed booking explicitly, and refreshes My
Bookings after submission so the customer sees the latest server state.


## V88 — guest-link security control in My Bookings
The backend could revoke a guest booking link since V76, but customers had no
way to use that security control from the product. V88 exposes only the safe
revocation state (never the token/hash) in booking detail and adds a signed-in
My Bookings action to revoke an active guest link. The UI warns that old links
will stop working, refreshes from the server after revocation, and shows the
revoked state instead of continuing to offer the action.


## V89 — customer dispute flow in My Bookings
The dispute backend and supplier action existed, but customers had no comparable
path from the canonical booking portal. V89 adds a `Report a problem` action for
appropriate active and terminal rental states. It works for signed-in customers
and secure-link guests, passes the existing booking access credential when
needed, handles duplicate open disputes clearly, and gives immediate support
handoff feedback after a successful report.


## V90 — cross-device customer dispute authorization
The V89 customer dispute UI exposed a deeper authorization mismatch: the server
accepted a customer dispute only when a guest payment token was supplied. A
signed-in customer viewing their own booking on another device therefore could
see `Report a problem` but receive `Booking access denied`.

The dispute endpoint now authorizes the authenticated booking owner by normalized
account email, while preserving secure guest-token access and supplier/admin
ownership checks. Client-supplied `openedBy` still does not decide authority.


## V91 — unified booking ownership authorization
Cancellation and review already shared a booking-access guard, but account
ownership was determined by loading the customer's full booking history and
scanning it. V91 uses a direct booking lookup and normalized owner-email
comparison instead. Supplier authorization and secure guest-token fallback are
preserved. This keeps cross-device cancellation/review access consistent with
the dispute authorization hardened in V90 and scales better with booking history.


## V92 — major customer listing & booking experience
Rebuilt listing detail into a conversion-focused rental page: item presentation, rating/location context, trust/supplier reassurance, fulfilment/deposit/cancellation facts, safe review preview, and a sticky booking card with dates, quantity, estimated total and one obvious next action. Mobile collapses to a clean single-column journey.


## V93 — supplier command center
Begins the professional supplier-dashboard jump. Replaces hard-coded headline KPI values with live booking-derived revenue, pending, confirmed/active and utilization signals. Adds an operations command strip for pending requests, upcoming handovers, active rentals and returns; each card drills directly into the corresponding booking view. Responsive mobile layout included.


## V94 — supplier inventory & pricing workspace
Adds an authoritative supplier inventory workspace backed by the authenticated `/api/supplier/listings` endpoint. Suppliers get live listing/unit counts, average daily rate, daily inventory earning capacity, per-item stock/pricing/deposit/location, and one-click drilldown into the existing availability calendar. This replaces another major slice of demo-only dashboard behavior with owner-scoped server data.


## V95 — supplier earnings & payout forecast
Adds a finance workspace using live booking values: gross booked value, completed-rental value, in-progress value, an explicitly estimated platform-fee preview, estimated supplier earnings, and a recent booking ledger. The preview is deliberately labelled non-authoritative until real payment/payout records are connected, and links directly into existing Stripe Connect payout setup.


## V96 — authoritative payment economics in supplier finance
The supplier finance workspace now consumes the payment split already persisted by the Stripe payment-intent flow (`platformFeeAmount` and `supplierAmount`) whenever it exists. Only bookings without a recorded split use the clearly-labelled forecast rate. Each ledger row states whether its economics are recorded or forecast, preventing the dashboard from presenting a generic percentage as if it were settled payment data.


## V97 — security-deposit foundation
Introduces a first-class security-deposit amount on bookings. The deposit is
derived authoritatively from the listing on the server and persisted separately
from rental `orderValue`, so it cannot accidentally inflate supplier revenue or
platform commission. The authoritative price model now exposes rental total,
security deposit and total payment exposure separately. Customer checkout also
discloses the refundable security deposit as its own line item.

V97 deliberately does not claim that Stripe is holding/capturing the deposit
yet. The next payment phase must choose and implement the production deposit
mechanism (for example authorization/capture or a separate refundable charge)
with explicit expiry, damage and release rules.


## V98 — deposit return/claim lifecycle
Security deposits now have explicit lifecycle state separate from rental revenue.
When a supplier records a return in good condition, a required deposit moves to
`release_pending`. Damaged or missing returns move to `claim_pending` and are
explicitly held for review rather than being automatically captured. Customers
receive deduplicated deposit-status notifications. Resolution metadata and
timestamps are persisted for auditability.

This remains payment-provider safe by design: V98 models and communicates the
decision state but does not falsely mark money as released/captured until the
Stripe-side deposit mechanism is implemented and confirmed.


## V99 — separate Stripe security-deposit authorization
A required deposit can now be prepared as a separate Stripe PaymentIntent with manual capture. It is not a Connect transfer and therefore cannot be treated as supplier revenue. The endpoint is rate-limited, supports signed-in booking owners and secure-link guests, uses deterministic idempotency, validates reused intents against booking/purpose/amount/currency, and persists provider state. Capture/release remains gated by the return/claim lifecycle and provider confirmation.


## V100 / 1.0.0-rc.1 — closed-loop deposit resolution
The security-deposit lifecycle now reaches provider-confirmed terminal actions.
Admins can release a `release_pending` manual authorization by cancelling the
Stripe authorization, or resolve a reviewed `claim_pending` case by capturing
all or part of the authorized deposit. Capture is bounded by the authoritative
deposit amount, requires a meaningful written resolution, uses deterministic
idempotency, validates the Stripe intent identity/purpose/state, persists
terminal state, and notifies the customer. This intentionally keeps collateral
finalization out of supplier self-service.

This is labelled Release Candidate rather than production-final: real Stripe
credentials/webhooks, browser E2E, operational monitoring and deployment
infrastructure still require environment-level validation.


## V101 / 1.0.0-rc.2 — map-first discovery
Map mode is now a split-view rental discovery surface with result count, marker-selected listing preview, location/distance, pricing, fulfilment/trust cues and a direct route into the canonical listing/booking experience. Mobile stacks the preview below the map.


## V102 / 1.0.0-rc.3 — customer notification center
Adds an authenticated customer notification API and a responsive in-product notification center with unread badge, secure no-store responses, escaped content, read-state updates and booking deep navigation. Existing booking/payment/deposit notifications now become visible as a coherent customer inbox instead of living only in individual booking timelines.


## V103 / 1.0.0-rc.4 — customer E2E journey clarity
Launch audit found the post-booking screen still claimed “Booking confirmed” immediately after creating a pending request and even called it a prototype. RC4 removes that misleading state and introduces a lifecycle-aware confirmation journey: request created → secure payment → supplier confirmation → pickup/delivery. The screen adapts to recorded payment/booking state and provides a direct My Bookings continuation path.


## V104 / 1.0.0-rc.5 — remove misleading supplier demo economics
Launch audit removed the remaining hard-coded October revenue summary from the canonical supplier dashboard and replaced it with live category economics derived from eligible bookings, authoritative/forecast payment splits and the supplier's actual listings. The old demo inventory panel is hidden from the canonical dashboard in favour of the live V94 inventory workspace. Empty accounts now show honest zero/empty states instead of fabricated revenue.


## V105 / 1.0.0-rc.6 — legacy demo runtime quarantine
Launch audit removed the historical in-browser supplier demo simulation. Fake booking/inventory controls and the placeholder booking number are removed from visible markup. The canonical supplier runtime remains server-backed through `/api/rentals/bookings` and the live inventory/finance workspaces. This reduces accidental demo-state execution without destabilizing the layered MVP before final decomposition.


## V106 / 1.0.0-rc.7 — strict Stripe webhook binding
Critical launch audit hardening: rental payment success/failure webhooks now fail closed unless the Stripe PaymentIntent is the exact intent stored on the booking and its booking metadata, authoritative amount, EUR currency and rental-payment purpose all match. An arbitrary PaymentIntent carrying a copied bookingId can no longer mark that booking paid, failed, trigger supplier/customer payment notifications, or enter the late-payment refund path. Newly created rental PaymentIntents are explicitly tagged `purpose=rental_payment`.


## V107 / 1.0.0-rc.8 — refund accounting integrity
Launch audit closed a refund-state gap: successful Stripe refunds now persist the actual refunded amount and update payment status to `refunded` or `partially_refunded` instead of leaving a refunded booking looking paid. Cancellation refunds are capped by the booking's remaining refundable balance, preventing repeated flows from requesting more than the authoritative order value. Late terminal refunds persist their full amount as well.


## V108 / 1.0.0-rc.9 — booking expiry lifecycle
Pending booking expiry is now an operational lifecycle rather than a silent database status flip. The expiry sweep identifies affected bookings, releases/cancels eligible rental and security-deposit authorizations, sends deduplicated customer and supplier notifications, and runs periodically as well as at the payment boundary. This prevents stale holds from lingering and makes released availability visible to both sides.


## V109 / 1.0.0-rc.10 — production-facing product polish
The first Product Polish pass removes exposed demo credentials, demo-login shortcuts and stale prototype/no-live-payment claims from the customer-facing product. Supplier account and payout copy now matches the real server-backed/Stripe-ready architecture, footer trust language is launch-appropriate, and checkout/account surfaces receive clearer accessibility/product semantics. Demo fixtures may remain internally for development, but are no longer advertised to end users.


## V110 / 1.0.0-rc.11 — supplier onboarding polish
Supplier sign-up is reduced to the information needed to create an account. Category strategy, plan selection, business address and website are deferred instead of blocking registration. A visible four-step journey (Account → First listing → Availability → Payouts) explains what happens next, and successful registration can continue directly into first-listing creation. Removed fields retain safe defaults for the existing server contract.


## V111 / 1.0.0-rc.12 — first-listing product polish
Listing creation is reorganized into four understandable sections: Item basics, Pricing & protection, Pickup & delivery, and Photos & description. Delivery-only controls are hidden and disabled when the supplier chooses Pickup only, reducing cognitive load without changing the existing backend field contract. Publishing now has a clear final review cue and stronger launch-ready CTA.


## V112 / 1.0.0-rc.13 — architecture extraction, phase 1
The first low-risk decomposition of the 244 KB monolithic frontend is complete. Six self-contained late-stage product layers are extracted into dedicated classic-script modules: customer notifications, post-booking journey, supplier revenue, production polish, supplier onboarding, and listing creation. They load after the stable core in deterministic order, preserving the existing global runtime contract while reducing `app.js` and establishing a safe seam for deeper decomposition. Static regressions now evaluate the composed frontend runtime rather than assuming every feature lives in one file.


## V113 / 1.0.0-rc.14 — real browser E2E harness
A Playwright browser test layer is now part of the repository. It boots the real RentInOrbit server and defines Chromium journeys for home/discovery/listing navigation, booking-surface visibility and the simplified supplier onboarding path. Failure traces and screenshots are configured. The environment used to build this RC does not have Playwright/Chromium installed, so the browser suite is packaged and dependency-declared but not falsely reported as executed; the existing dependency-free suite still validates the harness contract.


## V114 / 1.0.0-rc.15 — production launch gate + Stripe test-mode gate
RentInOrbit now has an explicit `/api/launch-readiness` gate that fails closed in production when launch-critical configuration is missing: Stripe secret/webhook, HTTPS APP_URL, transactional email configuration, worker token, support email and a sufficiently long session secret. Health remains a liveness signal but also reports readiness. A Stripe test-mode browser gate and lifecycle runbook are included for payment, webhook, deposit, refund and expiry evidence. Real provider execution still requires external Stripe test credentials and Playwright/Chromium; this RC does not claim those external tests passed.


## V115 / 1.0.0-rc.16 — operations, recovery and observability
Production operations hardening adds request correlation IDs and structured request logs, HSTS in production, graceful SIGTERM/SIGINT shutdown, crash visibility, SQLite backup/verification utilities and an explicit recovery runbook. Local backup tooling is intentionally documented as insufficient on its own: production still needs scheduled encrypted off-host backups and restoration drills.


## V116 / 1.0.0-rc.17 — final 1.0 release gate audit
The repository now contains an explicit PASS / BLOCKER / EXTERNAL release decision document, evidence checklist and machine-readable preflight command. This deliberately does not rename the build to 1.0: browser execution, Stripe test-mode provider evidence, backup restore drill, production readiness and physical-device smoke tests remain launch blockers requiring external runtime/services.


## V117 / 1.0.0-rc.18 — Stripe Connect v2 migration guard
A payment architecture audit found legacy Connect v1 Express account creation and deprecated readiness fields in the supplier onboarding path. New supplier account creation now fails closed instead of provisioning a legacy account. Existing connections remain untouched. PaymentIntent reuse validation now also binds the stored intent to `purpose=rental_payment` and the exact supplier destination. The target Accounts v2 recipient architecture and remaining sandbox migration steps are documented in `release/STRIPE_CONNECT_V2_MIGRATION.md`.


## V118 / 1.0.0-rc.19 — Connect capability fail-closed bridge
Deprecated v1 `charges_enabled` / `payouts_enabled` readiness checks were removed from executable supplier status logic. Rental destination payments now require a stored Connect v2 migration marker and an explicitly active `stripe_transfers` capability; legacy connected accounts are treated as read-only migration candidates rather than payment-ready. Legacy onboarding/login flows no longer imply production readiness. This deliberately keeps new supplier payouts blocked until real Accounts v2 provisioning and capability retrieval are sandbox-validated.


## V119 / 1.0.0-rc.20 — Accounts v2 capability state model
The database now persists the Connect API generation, recipient `stripe_transfers` capability state and outstanding requirements. A single parser reads the required Accounts v2 capability path and an admin-only ingestion bridge safely persists a verified provider-shaped account object after matching it to the supplier's stored Stripe account ID. Rental payment gating can now rely on persisted v2 capability state rather than deprecated v1 booleans. Direct Accounts v2 creation and embedded onboarding remain blocked until the actual sandbox write path is authorized and validated.


## V120 / 1.0.0-rc.21 — customer journey & mobile shell
A visible end-to-end customer navigation layer now connects discovery, comparison, checkout and booking tracking. Desktop has a real My Bookings entry, the post-booking CTA is wired to the secure booking ledger, search results retain location/date/quantity context, and mobile gets a persistent Explore/Browse/Bookings/Account navigation bar. A sticky four-stage rental journey keeps orientation through discovery → choose → book → track without changing the established visual direction.


## V124 / 1.0.0-rc.22 — Supplier command center
Large supplier UX pass: a sticky operational navigation connects Overview, Inventory & pricing, Calendar, Bookings, Earnings and Payouts. Mobile dashboard layout is tightened for operational use. The obsolete second mobile bottom navigation was removed so the customer journey has one canonical mobile shell. Supplier forecast fallback now matches the server's default 15% platform fee; recorded payment splits remain authoritative.

## V126 / 1.0.0-rc.24 — Release Candidate engineering package
Added a browser-level RC suite for mobile entry, readiness secret leakage and unauthorized booking access; a dependency-free release gate; `/healthz` deployment probe; operational readiness client helper; and an RC deployment checklist. Critical Stripe webhook verification, supplier transfer-capability gating and guest booking token protection remain mandatory.


## V127 / 1.0.0-rc.25 — Customer booking hub
My Bookings now has Upcoming / Active / Past / All views, counts, explicit next actions, truthful payment/refund copy, and separate deposit state. Secure guest access and booking actions remain intact. Client readiness helpers were extracted into the module to preserve the architecture budget. Critical audit: {"webhook": true, "transfer_gate": true, "guest_token": true, "readiness": true}.


## V128 / 1.0.0-rc.26 — Supplier operations cockpit
Supplier Dashboard now opens with live inventory, action-needed bookings, upcoming rentals, estimated net earnings and Accounts v2 payout readiness. Existing server-side payment authority is unchanged; the cockpit consumes presentation-only snapshots. Critical audit: {"webhook": true, "transfer_gate": true, "guest_token": true, "readiness": true}.

## V143 / RC41 — Supplier Command Center
- Added a professional supplier command center with action-needed queue, active rentals, 7-day occupancy signal and paid-revenue KPI.
- Added inventory/publishing and revenue health signals plus direct operational jumps to bookings, inventory, calendar, and earnings/payouts.
- Kept the dashboard read-only where financial authority matters: checkout price, availability, payment state, and Stripe settlement remain server-authoritative.
- Added responsive mobile layout and `supplier-command-v143.test.js` regression coverage.

## V144 / RC42 — Supplier planning workspace
- Added a professional monthly occupancy calendar driven by supplier booking projections, with cancelled/declined/expired rentals excluded.
- Added pricing intelligence cards combining current daily rate and per-listing demand signals without granting browser authority over prices.
- Added responsive mobile calendar/pricing layouts and event-driven refreshes when booking or inventory projections change.
- Added `supplier-pro-v144.test.js`; RentInOrbit remains server-authoritative for booking, availability, pricing and payment state.

## V145 / RC43 — Live customer checkout handoff
- Repaired the discovery-to-listing date contract so listing details retain the selected `from` / `to` dates and quantity.
- Turned availability into a real conversion step: selected dates are preserved, quantity is explicit, the server checks the full rental window, and only an available selection can continue.
- Added a direct availability-to-checkout handoff that pins the exact listing instead of allowing heuristic listing selection.
- Added a second server availability preflight before delivery details and clarified that the final reservation action continues to Stripe rather than claiming payment too early.
- Added responsive states, accessibility announcements, cache invalidation, and `customer-handoff-v145.test.js` regression coverage. Price, availability, booking and payment authority remain on the server.
- Browser hardening removed three production startup failures caused by a deleted demo control, quarantined demo state, and authentication state initialization order; the Playwright server port contract is now explicit.
- The complete browser suite passes with 11 tests passing and the credential-gated Stripe lifecycle test skipped; all 109 root regression tests pass.

## V146 / RC44 — Production Foundation
- Added a single fail-closed production configuration contract loaded before database initialization.
- Railway deployments now require explicit persistent SQLite storage; unsupported `DATABASE_URL` providers are rejected rather than silently falling back to ephemeral disk.
- Added migration version 146, idempotent database initialization, WAL checkpointing, database health checks, and restart-safe shutdown.
- Added mode-matched Stripe key validation, explicit test/live environments, latest Stripe SDK/API configuration, and non-secret operational summaries.
- Added production Resend/worker requirements, HTTPS/session validation, Railway deployment configuration, and a complete deployment/rollback runbook.
- Unified liveness, readiness, launch, and operations endpoints on the current release version while preserving webhook signatures, guest tokens, and server authority.

## V147 / RC45 — Railway deployment runtime

- Added Railway Infrastructure as Code for GitHub `main`, a single European service replica, a persistent `/data` volume, and readiness-gated traffic activation; retained `railway.toml` only as a legacy compatibility fallback.
- Added a validated startup orchestrator that blocks Railway/production boot before listening when HTTPS origins, strong secrets, Stripe modes, Resend, proxy trust, notification modes, or mounted writable storage are invalid; interrupted email deliveries now recover safely after restart.
- Made both SQLite and listing uploads persistent on the Railway volume. Schema initialization remains idempotent and now records migration 147 only after the complete schema loads successfully.
- Strengthened `/api/readiness` with live configuration, storage, migration, database, shutdown, Stripe, email, maps, and notification checks while keeping `/healthz` as a minimal liveness probe.
- Added a public post-deployment smoke gate that verifies the homepage, health, readiness, operations, integration capabilities, persistent migration state, and secret non-disclosure using only the public URL.
- Preserved signed Stripe webhooks, Accounts v2 transfer capability gates, guest booking access tokens, and server-authoritative pricing, availability, payment, deposit, and payout state.


## V182 — supplier pre-launch activation & reliability

Added an admin-controlled supplier onboarding workflow for marketplace launch quality:
- Admin can create a supplier and listings without sending any invitation.
- Pre-launch listings are hidden from public search.
- Admin can invite one supplier or bulk-invite all ready suppliers when launch timing is chosen.
- Activation links bind the supplier account to all listings already assigned to the same email address.
- Activated suppliers must confirm current availability before prepared listings become public.
- Listing freshness expires after 30 days; reminders begin before expiry and stale listings are hidden.
- Booking requests have a supplier response deadline with reminder emails.
- Repeated unanswered requests increase a missed-response counter and can automatically suspend listings.
- Supplier listings support `Request to book` and `Instant Book` metadata; pre-launch defaults to request-based booking.
- Customers cannot book pre-launch, stale, suspended or moderation-blocked listings.

The first launch workflow is intentionally controlled by the platform admin: importing a supplier never automatically emails or publishes anything.
