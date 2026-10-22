# Stripe test-mode E2E gate

Before a production release, run RentAll with Stripe **test** credentials and a webhook secret. Required lifecycle evidence:

1. Create a real pending booking from the UI.
2. Create the rental PaymentIntent and complete a Stripe test payment.
3. Deliver the signed `payment_intent.succeeded` webhook and verify the exact booking becomes paid.
4. Confirm a mismatched PaymentIntent cannot mutate another booking.
5. Authorize a separate manual-capture security-deposit PaymentIntent.
6. Exercise deposit release and damage-claim capture paths.
7. Exercise full and partial rental refunds and verify persisted `refund_amount` / payment status.
8. Expire an unpaid booking and verify payment/deposit holds are released.
9. Verify customer and supplier notifications for each terminal state.

Do not use live keys for this gate. Store evidence/traces outside source control.
