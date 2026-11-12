# TEST payment reconciliation audit — 2026-11-12

Scope: TEST/sandbox only. Read-only verification. This record is not evidence of an actual provider refund or production readiness.

## Known IDs (all TEST)
- Booking: `RB-1794165791120-89e533`
- Supplier Connect account: `acct_1UYJrGLM72xqOs4D`
- PaymentIntent observed in staging app log: `pi_3UZcIeLM72xqOs4D0nMHx5VC`
- Direct charge referenced by application fee: `ch_3UZcIeLM72xqOs4D0EbBKmA2`
- Application fee: `fee_1UZcQtLM72xqOs4D1pz1WFzE`

## Confirmed source facts
1. Stripe TEST sandbox `acct_1UT4JCLM72MR015z` application fees list contains the fee above: **EUR 15.00**, `amount_refunded = 0`, `livemode = false`, with supplier account and charge links above, created 2026-11-08 20:11:19 UTC.
2. Staging runtime at 2026-11-08 20:11:24 UTC logged `Payment succeeded: pi_3UZcIeLM72xqOs4D0nMHx5VC`.
3. Staging HTTP logs contain two `POST /api/stripe/webhook` HTTP 200 at 20:11:20 UTC. HTTP 200 alone does not prove unique processing or business-level idempotency.
4. Staging HTTP logs for the specified booking show supplier status HTTP 200 at 19:25:42 UTC; pickup transfer-confirm HTTP 200 at 20:21:23 UTC; return-confirm HTTP 200 at 20:44:47 UTC; status HTTP 200 at 20:47:44 UTC.
5. Platform sandbox direct retrieval of the above Connect-owned PaymentIntent and charge returned `No such payment_intent` and `No such charge`. These errors are expected for direct charges outside current account scope and do not establish that the objects do not exist.
6. Platform-level GET refunds list was empty. It does not report refunds belonging to the supplier's Connect account.
7. The connected session exposes platform sandbox but does **not** expose `acct_1UYJrGLM72xqOs4D` as a directly selectable Stripe context. No LIVE requests were made.

## Not established — NO-GO items
- Independently verified provider charge gross amount of **EUR 100.00**, currency, final state and booking metadata.
- Merchant account refund ID, refund status/amount and the expected total refund of EUR 100.00.
- Application-fee reversal and balance movement for the specific charge.
- Cross-check of individual provider webhook deliveries versus application webhook audit entries.
- True E2E behavior for an actual provider refund and retry.

The EUR 15 fee is consistent with a 15% commission on EUR 100 but is **not standalone proof** of the payment amount. A separate platform-level EUR 100 intent from November 1 must never be mixed with this November 8 connected-account direct charge.

## Next action
Obtain read-only provider evidence in **TEST** connected account only (PaymentIntent, Charge, refunds, application fee refund and events). Compare exact IDs, `bookingId`, `amount=10000`, currency `eur`, account and statuses. Do not create new payments/refunds just to mark this audit completed. Keep production, LIVE Stripe and persistent `/data` untouched.

Result: **Partial reconciliation / NO-GO**.
