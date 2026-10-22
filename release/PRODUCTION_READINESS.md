# Production readiness
`GET /api/readiness` exposes only configuration presence, never secret values. Production requires Stripe secret + verified webhook secret, HTTPS public base URL, real email provider, and verified Accounts v2 recipient provisioning. Keep `STRIPE_CONNECT_V2_PROVISIONING=false` until sandbox provisioning is verified. Do not fall back to legacy Connect account types.
