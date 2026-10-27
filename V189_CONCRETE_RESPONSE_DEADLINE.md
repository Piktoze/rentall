# V189 — concrete supplier response deadline

Checkout now shows the renter a concrete supplier response deadline, e.g. `Tiekėjas turi atsakyti iki šiandien 12:00`.

- Before booking, the browser estimates the deadline with the same 08:00–22:00 supplier-active-hours rule used by the backend.
- After booking creation, the UI switches to the authoritative `supplierResponseDueAt` stored by the backend.
- Today/tomorrow wording is localized for LT / EN / ES / DE / RU; later deadlines show an explicit calendar date and time.
- When renter and supplier timezones differ, the copy explicitly says the deadline is in supplier local time.
- Instant Book listings continue to bypass the supplier-response deadline.
