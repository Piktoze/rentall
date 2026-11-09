# RentInOrbit — Lithuania-first legal launch blockers (staging draft)

Status: **NO-GO**. This is an implementation checklist, not a legal opinion or a certification. It must be reviewed against the final operator, contracting flow, features and actual data processors before going public.

## 1. Operator and contact details
- Decide and register the actual platform operator (e.g., registered individual activity or legal entity); publish **real** name/legal form, business address, required registration particulars and working contact channels.
- Provide accessible consumer-complaint and privacy contacts and an actual complaint-handling procedure.
- No fictional company registration, support phone/address or legally binding statement may be used as a placeholder in production.
- Configure the `LEGAL_OPERATOR_*`, `LEGAL_SUPPORT_EMAIL`, `LEGAL_COMPLAINTS_EMAIL` and `LEGAL_PRIVACY_CONTACT` launch prerequisites **only after** the real details have been verified.

## 2. Customer contract disclosures
- Make clear who is the actual item supplier/contracting lessor, whether the supplier is a trader or private person, and how applicable consumer rights differ.
- Before the final order confirmation show description, duration, rental and delivery charges, deposit, cancellation policy and provider identity as legally required.
- Confirm durable retention/accessibility of the accepted rental agreement and the user's ability to review/correct entries before contracting.
- State applicable complaint and out-of-court consumer dispute resolution information.
- The platform should not claim all private-to-private rentals give the same statutory consumer protections as trader-to-consumer contracts.

## 3. DSA marketplace controls — subject to applicability
- Determine DSA Article 30 trader traceability obligations, including proportionate trader identity and registry/payment-account verification **before traders can offer to EU consumers**, with any applicable micro/small-enterprise exception assessed.
- Assess DSA Article 31 compliance-by-design and public trader-information disclosures; do not collect copies of IDs through ad hoc unprotected forms.
- Document reporting/moderation, appeal/contact mechanisms and notices as applicable to the platform's classification and size.

## 4. Privacy and cookies
- Verify the actual GDPR controller and processor roles, legal bases per purpose, retention periods, data sharing, international transfers, data subject rights and regulator contact.
- Verify the actual cookies/local storage and tracking technologies. Obtain opt-in consent where legally required, before nonessential tracking begins; enable withdrawal.
- Identify the actual processors used (Stripe, email, hosting, backups, optional analytics) and reconcile disclosures to deployed behavior.

## 5. Payments, safety, tax and support
- Reconcile public refund and deposit wording to what Stripe Connect actually does. Do not promise platform-controlled funds or delayed supplier payouts without provider-backed enforcement.
- Review financial reporting, invoicing, DAC7/platform tax reporting applicability, fees and VAT with a qualified accountant.
- Complete a true €100 Stripe TEST order/payment/webhook/refund E2E and dispute handling before LIVE. The currently configured LIVE platform account is not payment-ready.
- Run human two-party browser QA with real staging UI and legal-text acceptance evidence.

## Implementation
- `legalLaunchReadinessReport()` is a **configuration checklist** only and does **not** prove legal compliance.
- `liveLaunchReadinessReport()` now also blocks when legal launch prerequisites are missing; external legal review and payment/provider verification remain separate.
- Keep production/main/LIVE Stripe and persistent /data untouched until a separate explicit approval and GO decision.

## Sources for final legal review
- VVTAT, information duties and alternative dispute resolution: https://vvtat.lrv.lt/lt/informacijos-teikimo-vartotojui-reikalavimai/
- Lithuanian information society service provider contract disclosures: https://vssa.lrv.lt/lt/veiklos-sritys/informacines-visuomenes-paslaugos-1/patarimai-perkant-prekes-ar-paslaugas-internete/
- Regulation (EU) 2022/2065 (DSA), Arts. 30–31: https://eur-lex.europa.eu/eli/reg/2022/2065/oj
- Regulation (EU) 2016/679 (GDPR), Art. 13: https://eur-lex.europa.eu/eli/reg/2016/679/oj
