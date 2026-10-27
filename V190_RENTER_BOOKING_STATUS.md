# V190 — renter booking status bar

Added a renter-facing booking decision status bar with four clear outcomes:

1. Waiting for supplier response
2. Confirmed
3. Declined
4. Auto-cancelled

The bar is shown immediately after booking, in the live post-booking tracker, and on each signed-in customer booking card. It is driven by server booking truth rather than local UI state. Supplier auto-declines are distinguished from manual declines using `supplier_auto_declined_at`; `expired` reservations map to the automatic-cancellation state with separate explanatory copy. Pending bookings can show the authoritative supplier response deadline.

Localized copy is included for LT / EN / ES / DE / RU.
