# Deferred SCT TEST integration and password recovery

Scope: `staging/v203`. This is not LIVE launch approval.

## Financial execution boundary

`RENTINORBIT_SCT_TEST_RUNTIME=true`, `STRIPE_MODE=test`, a validated TEST key and
`SCT_STRIPE_FEE_PAYER=platform` are required together. Model A was approved on 2026-11-18; supplier-paid configuration is rejected.
The actual open SQLite database must be under the system temporary directory
(symlinks resolved); memory is allowed only for tests. `/data` is refused.
Do not enable this runtime on the existing Railway volume or migrate historical
Direct Charge bookings. Normal deployment leaves the runtime disabled.

Only newly inserted bookings are enrolled, in the same SQLite transaction as
booking creation. Existing bookings are never enrolled by an administrative API.
Suppliers need an explicitly mapped TEST recipient, checked against Stripe v2
identity, recipient capability, requirements, and fee/loss responsibilities.
`POST /api/admin/sct-test/recipients` accepts email, accountId, entityType.
Administrative routes require an existing administrator session and normal CSRF
protection. Catalog mode continues blocking booking/authentication/payment writes.

Platform PaymentIntents have no connected-account charge context, destination
charge or application fee. The 15% commission is an immutable cents snapshot.
The platform charge initially credits the platform balance; it is not an early
supplier transfer. Both agreement consents and the existing pickup PIN/return
state machine are retained.

Every 30 seconds an opt-in worker first reconciles uncertain commands and then
considers confirmed good-condition returns. A transfer requires canonical return,
paid status, no dispute/hold, suitable recipient and an available EUR balance
transaction with actual processing fee. A transfer credits the connected Stripe
balance; it does not establish a bank payout.

For a 100 EUR rental the platform commission is 15 EUR and the supplier Stripe
balance transfer is 85 EUR. RentInOrbit bears processing, Connect and bank-payout
costs; none may be deducted from the supplier's 85 EUR. The platform commission
is revenue before these provider costs, not net profit. A full refund leaves no
supplier transfer or platform commission; unrecovered provider costs remain with
the platform. Existing enrollments with a different fee policy require review;
they are not automatically migrated.

Supported cancellation: unpaid booking (provider intent must be verified canceled
if present) or a paid full refund before handover. Partial/zero policy refunds,
security deposits and transferred-funds reversal require a separate verified
flow and remain blocked, rather than falling back to Direct Charges.

Command claims are persisted before provider calls, with deterministic idempotency
keys and unique booking/kind/provider IDs. An unknown outcome never authorizes a
second create request. Recovery completely paginates provider lists, requires
exactly one matching object, retrieves and validates it, and records financial
truth once. Zero matches, failed refunds and ambiguous matches remain blocked for
review. A pending refund locks payment/handover and is reconciled by the worker
or a verified TEST platform refund webhook. Failed refunds create a hold.
`POST /api/admin/sct-test/bookings/:id/reconcile` accepts kind;
actions `hold` (reason required), `settle` and `transfer` are also available.
No administrative action releases a hold or blindly retries an unknown result.

## Password recovery

The fixed configured HTTPS application origin is used for links (HTTP loopback
only in local tests). A 32-byte random token expires in 30 minutes; only its
SHA-256 hash is stored. Issuing a new token invalidates the previous token.
Outbox payloads use AES-256-GCM with an HKDF-derived SESSION_SECRET key, so a raw
bearer token is not stored in the database/outbox. SESSION_SECRET must have at
least 32 characters. Rotating it invalidates undelivered encrypted reset emails.

The link uses a URL fragment, removed immediately by the page. POST responses
are uniform for present/absent accounts, including address throttling. Limits:
3 requests/address/hour; 5 requests/IP/15 min; 10 consumption attempts/IP/15 min.
Successful consumption atomically deletes the token, changes the password and
revokes existing sessions. No automatic login. Deployed demo identities are
excluded. The existing Resend worker renders and delivers reset email; no DNS
changes are involved. Catalog mode continues to deny this flow.

## Evidence and remaining execution work

`node --test password-recovery.test.mjs sct-test-runtime.test.mjs`: 13 isolated
tests. Stripe SDK methods use provider doubles, not real Stripe TEST objects.
`node password-recovery-http.test.mjs`: real local HTTP recovery, encrypted
outbox, CSRF, token replay, old/new password, revoked session and throttling.
Both are mandatory in the release gate and staging CI.

Before calling the financial blocker resolved, execute independent fresh A/B
orders against real Stripe TEST in disposable storage, record provider IDs and
signed webhook evidence, and verify the actual connected balance. The safe
Railway build execution path is implemented, so a user-supplied chat API key is
not needed. Its first real preflight is blocked by Stripe-hosted TEST recipient
terms acceptance, not by an unverified assumption about provider readiness.
See `approved-model-a-costs.md` for the real recipient and remaining requirement
fields. Recovery delivery to the authorized Gmail inbox has been verified:
SPF/DKIM/DMARC pass; link HTTP 200, consumption 200, replay 400, independent memory
storage. No private URL or token is recorded. Existing Stripe TEST orders are
not a substitute for new SCT A/B evidence. LIVE gates remain in place.
