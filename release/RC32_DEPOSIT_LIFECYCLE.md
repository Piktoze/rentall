# RC32 — provider-confirmed security deposit lifecycle

Security-deposit authorization is now synchronized from signed Stripe webhook events. `payment_intent.amount_capturable_updated` marks a matching manual-capture deposit as authorized. `payment_intent.canceled` records provider-confirmed release. Both paths validate intent ID, booking metadata, purpose, EUR currency and exact authorized amount before state mutation. Admin capture/release controls remain unchanged and server-authoritative.
