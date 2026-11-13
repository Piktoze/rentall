# RentInOrbit SF V286: staging implementation and launch controls

## Scope (2026-11-13)
- Work restricted to `Piktoze/rentall` branch `staging/v203` and Railway staging.
- Stripe TEST only. No production, Stripe LIVE, existing financial operations or manual `/data` edits.
- Individual-activity marketplace operator and 15% application fee, subject to final contract/tax review.
- Operator name, VMI correspondence address and certificate number are populated from Railway staging environment configuration, **not** committed as source constants. PDF does **not** show an email address.

## Implemented
1. Separate SQLite invoice draft ledger, issuer-specific number sequences, audit trail and stable idempotency keys.
2. TEST-only automatically-created commission draft on eligible verified TEST payment webhook.
3. Void of *unissued draft* after verified full TEST refund. Already numbered document stays immutable for manual review.
4. Guarded TEST-only numbering, PDF rendering with DejaVu Unicode font, LT text, non-accounting-document watermark.
5. Authenticated staging admin: `GET /api/admin/accounting`; `GET /api/admin/accounting/invoices`, `invoices.csv`; `POST /api/admin/accounting/test-drafts`; `POST /api/admin/accounting/test-drafts/:id/number`; `GET /api/admin/accounting/test-drafts/:id.pdf`; `GET /api/admin/accounting/test-drafts/:id/email-preview`.
6. Authenticated supplier: `GET/PUT /api/supplier/accounting/profile`, `GET /api/supplier/accounting/documents`, `GET /api/supplier/accounting/documents/:id.pdf`. Supplier can access only their own draft documents. Supplier claims are unverified until manual review.
7. Staging admin synthetic expense register: `GET /api/admin/accounting/expenses`, `POST /api/admin/accounting/expenses/test`, `GET /api/admin/accounting/expenses.csv`. VAT classification always pending review.
8. Email HTML preview (no delivery) and regression tests in `v203-stabilization.test.js`; release gate executes the tests in an isolated DB environment.

## Explicitly NOT enabled
- Real invoice issuance, accounting-valid numbering, emails with live documents, automatic issuance for suppliers, automated credit notes, full accountant-approved VAT treatment, individual-activity tax return integration.
- No historical Stripe TEST order is backfilled.
- No TEST document is to be considered a tax invoice, including TEST-numbered versions.
- No real person’s email is used for invoice test delivery.

## Before LIVE
1. Confirm registration of EVRK activity and operator tax identification fields with accountant/VMI.
2. Check whether foreign services (Stripe, Railway, Resend, domain registrar and advertising) trigger reverse-charge VAT registration, and decide whether to register under Lithuania's small-business VAT scheme (SVS).
3. Approve platform role as disclosed intermediary, commission tax point, partial/full refund credit-note rules and sellers' invoicing authority.
4. Collect supplier seller registration/VAT data and explicit delegated invoice issuance agreement.
5. Design a production document delivery workflow with secure authenticated downloads, recipient consent, retry and bounce handling, GDPR retention, reconciliation, issue sequencing and verified tax mode. Test on isolated synthetic staging data.
6. Do not activate LIVE document issuance until *all* legal and accounting prerequisites are independently verified.

## Run
`NODE_ENV=test DB_PATH=:memory: node v203-stabilization.test.js` outside the Railway deployment environment.
Deployment build runs `node release/rc-gate.js`.
