# Transactional email delivery — RC45
RentInOrbit now includes an in-process delivery worker backed by the durable `email_outbox`.

Safe default: `EMAIL_WORKER_ENABLED=false`. Booking flows continue to enqueue messages without external credentials.

Production Resend configuration (deployment secrets/config only):
- `EMAIL_PROVIDER=resend`
- `EMAIL_FROM=<verified sender>`
- `RESEND_API_KEY=<secret>`
- `EMAIL_WORKER_ENABLED=true`
- `EMAIL_WORKER_TOKEN=<separate 32+-character random value>`

The worker claims durable outbox rows, renders existing customer/supplier booking templates, sends them, marks successful rows `sent`, and retries failures up to `EMAIL_MAX_ATTEMPTS`. Rows interrupted in `sending` state are returned to the retry queue on process restart, and graceful shutdown gives an in-flight delivery up to five seconds to finish. Console delivery is rejected in production worker mode. Provider credentials are never exposed through readiness/ops endpoints or frontend code.
