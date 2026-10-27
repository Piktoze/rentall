# Stripe Connect v2 migration — RentInOrbit

RentInOrbit is a marketplace: buyers checkout through RentInOrbit, RentInOrbit retains a transaction fee, and one supplier receives proceeds.

## Target
- Accounts API: v2 `/v2/core/accounts`
- Connected account role: recipient, not merchant
- Capability: `configuration.recipient.capabilities.stripe_balance.stripe_transfers`
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
6. Gate destination PaymentIntent creation on active `stripe_transfers`.
7. Run sandbox E2E evidence before public launch.
