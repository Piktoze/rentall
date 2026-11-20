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


## Private own-domain TEST access (2026-11-19)

This is private full-application TEST availability, not public/LIVE launch approval.
`PRIVATE_TEST_ENABLED=true` requires staging, TEST secret and publishable keys,
SCT TEST runtime, catalog=false and demo payments=false together. A separate
`PRIVATE_TEST_REQUIRED=true` interlock prevents accidentally dropping the gate.
The existing Railway service is reused; no additional service, volume or plan is
ordered. Existing metered Railway resource usage still applies.

SQLite and uploads resolve exclusively to
`os.tmpdir()/rentinorbit-private-test/<random-32-hex-run>/`. Existing DB_PATH,
DATABASE_URL, uploads and the `/data` mount are not used, copied or migrated.
Symlink paths are rejected; backups and schedulers are disabled. Test data is
disposable and may disappear on deployment. Production storage checks remain
unchanged when this explicit private TEST mode is off.

All pages, assets, uploads and APIs require a server-validated private session.
The access page `/__test-access` sends an eight-digit, ten-minute, single-use code
only to configured operator mailboxes, with per-IP/email limits and five guesses.
Codes are HMAC-hashed in process memory, never stored in SQLite or application
logs. Access sessions use an opaque, hashed, 12-hour server-side session and
`__Host-rio_test` (Secure, HttpOnly, SameSite=Lax, Path=/, no Domain). Restarting
the process revokes access. Normal account password/session, CSRF, moderation,
contract, pickup, refund and transfer guards remain in force.

Only GET /healthz and POST /api/stripe/webhook bypass the private login. Webhooks
still require the real Stripe signature and explicit TEST livemode=false. The
readiness API stays private; Railway health checking therefore uses /healthz.
Private pages and static responses are no-store. The private service worker
clears only RentInOrbit application caches and unregisters itself.

After mailbox verification and normal account registration/login, only the
configured owner email in the isolated database receives the TEST administrator
role needed for moderation. Client-supplied admin roles remain ignored. Default
demo/admin accounts are not seeded. Owner-to-TEST-recipient mapping is verified
against Stripe; unmet recipient requirements remain blockers, not bypasses.
Transactional email recipients are restricted to the same configured allowlist.

APP_URL and PUBLIC_BASE_URL must both be https://rentinorbit.com. Exact www and
old Railway browser URLs redirect to the apex, retaining path/query. Canonical
account cookies remain host-only and Secure. Existing TEST webhook callbacks on
the Railway host can continue to reach the signature-validated receiver.

Validation added: private-test-access.test.mjs and private-test-http.test.mjs,
including production-mode startup using disposable storage, real HTTP auth gate,
owner bootstrap, no default credentials, canonical redirects, own-domain reset
links, OTP replay/expiry/limits, logout, assets/uploads denial and symlink refusal.
These checks do not substitute for real own-domain TLS or Stripe TEST E2E.

Current evidence (2026-11-20 17:40 UTC): own-domain private TEST is connected;
the operator personally completed Stripe-hosted TEST consent. A fresh recipient
read passed the readiness gate. Both real API financial scenarios passed in a
disposable SQLite database: €100 rental to €85 connected Stripe balance transfer
after return, and a separate €100 cancellation/full refund, with actual signed
webhook receipt and replay protection. See `evidence/2026-11-20-sct-real-test.json`.
No bank payout or complete browser payment journey is proven by that API run.
The one-shot build run variable was cleared after evidence collection to prevent
unrequested repetition on future deployments. No terms accepted by the agent.


### Owner-operated Stripe TEST consent from the private site

After verifying the configured owner mailbox, `/__test-access` and the main page
provide a POST button to `/__test-access/stripe-recipient`. This bridges only to
the explicitly configured existing synthetic TEST recipient. It requires the
opaque private session, exact owner identity, same-origin POST and valid private
TEST configuration; other invitees and unsigned visitors are denied. Stripe
retrieval must confirm `livemode=false` and the synthetic account identity. The
provider link must target `https://connect.stripe.com`, match the same account
and be TEST. No account, bank data or identity is created/changed, no funds move,
and no terms are accepted by this code. Redirect responses are private/no-store;
provider error bodies and private URLs are not logged. This avoids relying on an
invisible cloud-browser handoff or publishing a private onboarding URL in chat.
The operator performs the review/consent herself on Stripe. Returning from Stripe
is not treated as proof of acceptance; the account must be re-read before A/B.
