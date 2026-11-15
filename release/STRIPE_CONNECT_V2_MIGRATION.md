# Stripe Connect v2 migration — RentInOrbit

> **2026-11-15 STATUS: HISTORICAL DIRECT/DESTINATION-CHARGE DESIGN — NOT AN APPROVED RENTINORBIT LAUNCH ARCHITECTURE.**
>
> The approved business requirement is **85% to the supplier only AFTER confirmed item return and financial holds cleared**. Destination charges automatically put funds in the connected account and do NOT enforce the required pre-transfer hold. The new architecture candidate is platform Separate Charges and Transfers (SCT), with release controlled after return. Its merchant-of-record, invoice/tax model, account-specific capabilities, risk liability, and hold limits remain **NO-GO** until the explicit checks in [SCT decision gate](./STRIPE_SCT_DECISION_GATE_2026-11-15_LT.md) pass.
>
> Do not implement or enable the target destination-charge configuration below as a substitute for the SCT requirements. This document is kept for historical migration analysis only. No production, LIVE Stripe, account or persistent data change has been authorized.


RentInOrbit is a marketplace: buyers checkout through RentInOrbit, RentInOrbit retains a transaction fee, and one supplier receives proceeds.

## Target
- Accounts API: v2 `/v2/core/accounts`
- Connected account role: recipient, not merchant
- Capability: `configuration.merchant.capabilities.card_payments`
- Dashboard: Express
- Fees collector: application
- Losses collector: application
- Standard one-supplier rental: destination charge
- Platform fee: `application_fee_amount`
- No `on_behalf_of`
- Check v2 transfer capability status before creating the rental payment
- Use webhooks as payment source of truth
- Include embedded `notification_banner` in supplier account UX

## Current RC18 safety behavior
Legacy `stripe.accounts.create({type:'express'})` creation has been removed from the executable path. New supplier payout onboarding fails closed with `CONNECT_V2_MIGRATION_REQUIRED` until Accounts v2 provisioning is implemented and validated against the RentInOrbit Stripe sandbox.

Existing stored connected-account IDs are not deleted or mutated.

## Before enabling supplier onboarding
1. Upgrade/pin Stripe Node SDK to a version supporting the required Accounts v2 path.
2. Implement v2 recipient creation.
3. Implement embedded onboarding / account session.
4. Persist v2 account identifier and capability state.
5. Consume account requirement/capability webhooks.
6. Gate direct PaymentIntent creation on active `card_payments`.
7. Run sandbox E2E evidence before public launch.
