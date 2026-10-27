# RentInOrbit V182 — Supplier pre-launch workflow

## Admin workflow
1. Open the Admin dashboard.
2. In **Supplier pre-launch**, create the supplier using the email address that will belong to that supplier.
3. Add the supplier's rental items in **Add pre-launch listing**. These listings are hidden from customers.
4. Do not send an invitation until launch timing is right.
5. When ready, use **Send invite** for one supplier or **Invite all ready** for the batch.

## Supplier workflow
1. Supplier receives a secure activation link.
2. Supplier creates/activates the RentInOrbit account with the same email address.
3. All listings that the admin created for that email appear automatically in the supplier account.
4. Prepared listings remain hidden until the supplier confirms that they are current.
5. **Confirm all listings are current** activates eligible listings.

## Reliability rules
- Admin-created listings start as `prelaunch`.
- After account activation they become `pending_confirmation`.
- Supplier confirmation moves them to `active`.
- Availability confirmation expires after 30 days; stale listings are hidden.
- A freshness reminder is queued before expiry (default: day 25).
- `Request to book` listings use a supplier response deadline (default: 4 hours).
- Reminder emails are queued after 30 minutes and 2 hours when a paid/persisting request is still waiting.
- An unanswered request is automatically declined at the deadline, with payment cancellation/refund handling through the existing payment logic.
- Repeated missed responses can suspend the supplier's active listings (default: after 3 missed requests).
- `Instant Book` listings auto-confirm after successful payment.

## Notifications
The V182 flow uses the existing RentInOrbit in-app notifications and transactional email outbox/worker. Real email delivery still requires the production email provider and worker environment settings already used by RentInOrbit.
