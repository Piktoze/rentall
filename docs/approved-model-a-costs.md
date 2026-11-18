# Model A — approved 2026-11-18

New SCT bookings use a 15% platform commission and 85% supplier share, rounded
in integer cents. A EUR 100 rental transfers EUR 85 to the supplier Stripe
balance after confirmed good-condition return, with no dispute or hold.
This transfer is not a bank payout. Processing, Connect and bank-payout costs
belong to RentInOrbit and must not be deducted from the supplier share.
The platform commission is before provider costs, not net profit.

`modules/platform-cost-policy.js` is the policy source. The TEST runtime requires
`SCT_STRIPE_FEE_PAYER=platform`; other settings fail closed. It rejects existing
enrollments with another fee-payer model rather than changing their economics.
Historical Direct Charge bookings and their pricing snapshots are not migrated.

A full refund before handover returns the full rental price and leaves no
commission or supplier transfer. Provider costs Stripe does not return stay
with RentInOrbit. There is no supplier debit or recovery of those costs.
Partial/zero policy refunds, deposits and transferred-funds reversal remain
blocked until implemented and independently verified. This decision does not
authorize LIVE payments or remove the catalog/public launch gates.

## Public Lithuanian pricing, checked 2026-11-18

Sources: https://stripe.com/en-lt/pricing and
https://stripe.com/en-lt/connect/pricing . These are public standard rates, not
proof of this account's private/custom pricing agreement.

| Cost | Public listed rate | Platform responsibility |
| --- | --- | --- |
| Standard EEA card processing | 1.5% + EUR 0.25 | Yes; EUR 1.75 on EUR 100 at this rate |
| Connect active account | EUR 2/month per active account; active when bank/card payout occurs | Yes |
| Connect bank payout | 0.25% + EUR 0.10 per payout | Yes; not deducted from the 85% share |
| Funds routing/platform management | Comparison table separately lists 0.25% of bank payout volume | Verify account billing applicability; do not assume included, additional or sum twice |
| Instant payout | 1% of payout volume in the Connect comparison table | Optional; not enabled or tested |
| Cross-border payout | Starting at 0.25% of payout volume | Conditional; not enabled by this change |

Premium/non-EEA cards, currency conversion and disputes can have other rates.
Do not infer the account tariff from synthetic TEST fees. Account Features API
lookup returned `The API method cannot be found`; private fee settings therefore
remain unverified. Do not claim all provider costs are only the card processing
fee or that a TEST balance transfer proves a bank payout or its charges.

## Outstanding real execution evidence

No successful new real Stripe SCT A/B objects are asserted by this document.
The secure CLI login is waiting for user authorization; no API key is requested
in chat. TEST recipient list in sandbox `acct_1UT4JCLM72MR015z` returned no
recipient-configured accounts. An eligible synthetic TEST recipient and real
TEST runtime execution are still needed. No historical account/order operation
may substitute for that evidence.

Real recovery email must be generated for a synthetic user in disposable
storage and delivered to the authorized Gmail address. It must not reset an
existing user's password or write the mounted `/data` database. Until safe
isolated mail-sending access is available, HTTP/outbox tests do not prove delivery.
