# v203 staging patch inventory

Verified against Railway staging on 2026-11-05. Values were neither printed nor copied. The current service builds commit source directly; no build or pre-deploy command evaluates these variables. They remain preserved for rollback compatibility only.

| Variable | Historical behavior now represented in source |
|---|---|
| `STAGING_HOTFIX_REV` | Historical patch-set revision marker |
| `STAGING_PATCH_1` … `STAGING_PATCH_5` | Early checkout/reservation staging patch chain |
| `STAGING_PATCH_CANCEL_EMAIL` | Cancellation transactional email |
| `STAGING_PATCH_CANCEL_UI_REFRESH` | Refresh booking UI after cancellation |
| `STAGING_PATCH_CONFIRMED_EMAIL` | Supplier-confirmed booking email |
| `STAGING_PATCH_CUSTOMER_PAY_DEEPLINK` | Customer payment deep link |
| `STAGING_PATCH_CUSTOMER_PAY_INLINE` | Inline customer payment action |
| `STAGING_PATCH_DIAG` | Staging diagnostic output |
| `STAGING_PATCH_EMAIL_RETRY` | Transactional email retry/deduplication |
| `STAGING_PATCH_I18N_DYNAMIC` | Dynamic UI translations; superseded by the explicit v203 pipeline |
| `STAGING_PATCH_JSON` | Authenticated JSON request/header behavior |
| `STAGING_PATCH_LIFECYCLE_GUARDS` | Booking state-transition guards |
| `STAGING_PATCH_PICKUP_SERVER` | Server-authoritative pickup/handover state |
| `STAGING_PATCH_POSTPAYMENT_EMAIL` | Post-payment notification email |
| `STAGING_PATCH_SUPPLIER_DEEPLINK` | Supplier booking deep link |
| `STAGING_PATCH_SUPPLIER_EMAIL_ESCAPE` | Safe supplier email rendering/escaping |
| `STAGING_PATCH_TERMINAL_PAYMENT_GUARD` | Prevent payment in terminal/already-paid states |
| `STAGING_SUPPLIER_FIRST_PATCH_B64` | Original encoded supplier-first bootstrap patch |

Source-control evidence: checkout, email, lifecycle, payment, deep-link and i18n regression tests cover the merged behaviors. `.railway/railway.ts` uses `preserve()` for these names but never decodes or executes them. Removing them is intentionally deferred until rollback retention is no longer required.
