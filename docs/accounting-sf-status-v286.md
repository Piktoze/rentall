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

## P0: company rents from private person – withholding and document safety (V287)

- The checkout asks whether the renter is a natural person or a company and captures company name if selected.
- The server persists renter legal kind and company name in the booking record.
- If the renter is a company, the server rejects a reservation and any subsequent rental PaymentIntent or security-deposit intent unless the supplier has an independently reviewed business accounting profile (individual activity/company). Supplier-only self-declaration is insufficient.
- Error code: `PRIVATE_TO_COMPANY_TAX_REVIEW_REQUIRED` (HTTP 409).
- Existing private-person-to-private-person rental checkout remains permitted; it is not the platform's role to issue 100% of the underlying rental invoice under the platform operator's name.
- Rationale: a Lithuanian company paying rent to a natural person without a business activity status can have A-class income withholding/reporting obligations; Stripe Direct Charges do not automatically fulfill the company's obligations.
- **Before enabling this B2B private-supplier category:** obtain accountant/VMI-reviewed documentary flow, determine responsibility for withholding and declarations, implement a compliant Stripe funds flow, capture required identities and evidence, and verify accounting entries. Do not switch off the guard to facilitate launch.
- The payer-selected buyer type is self-declared. Before broader LIVE B2B use, add independently verified company-identity and authorized purchasing evidence to avoid buyers misclassifying purchases.
- Production and Stripe LIVE are unchanged. This block covers only new staging changes until a separately approved LIVE release.

## V288 – audituojama verslo nuomotojo patikra (staging)

- Nuomotojo rekvizitų deklaracija nėra verslo statuso įrodymas. Savarankiškas profilio redagavimas visada atšaukia ankstesnę patikrą.
- Tik prisijungęs administratorius gali peržiūrėti `GET /api/admin/accounting/supplier-profiles`, istoriją `GET /api/admin/accounting/supplier-profiles/:email/audit` ir pateikti `POST /api/admin/accounting/supplier-profiles/:email/review`.
- Patvirtinimui reikalingi `confirmEvidenceReviewed=true`, `decision=approve`, dokumentais pagrįstas `evidenceReference` ir `reviewNote`. Leidžiami tik pakankamai užpildyti IV / juridinio asmens profiliai. Privataus fizinio asmens patvirtinimas kaip verslo nuomotojo neleidžiamas.
- Tik po tokios administratoriaus peržiūros juridinio nuomininko užsakymas su atitinkamu verslo nuomotoju gali pereiti į įprastą rezervacijos ir TEST apmokėjimo procesą.
- Peržiūros žurnalas yra papildomas; ankstesni įrašai netaisomi. Patvirtinimas nereiškia teisės automatiškai išrašyti nuomos SF pardavėjo vardu.
- Administratoriaus patikra turi būti atliekama pagal realius dokumentus, ne su TEST pateikiamais fiktyviais duomenimis.
- Dar lieka neįgyvendinta juridinio pirkėjo tapatybės / įgaliojimų verifikacija, todėl LIVE B2B paleidimo sprendimas tebėra atskiras blokatorius.

## V289 – patikimas TEST SF pristatymo paruošimas

- Po patvirtinto naujo Stripe TEST mokėjimo saugomas komisinių sąskaitos juodraštis ir atskiras `accounting_invoice_delivery_previews` įrašas.
- Pristatymo įrašas turi unikalią `(document_id,recipient_email,purpose)` kombinaciją; pakartotiniai webhook įvykiai nekuria naujo pranešimo.
- Ši lentelė nesujungta su `email_outbox`, todėl TEST sąskaitos laiškas fiziškai **nesiunčiamas**, net jei staging el. laiškų siuntimo worker būtų įjungtas.
- Atšaukus juodraštį dėl patvirtinto pilno refund, susietas pristatymo peržiūros įrašas taip pat atšaukiamas.
- Admin: `GET /api/admin/accounting/delivery-previews`; saugus tik TEST paruošimas `POST /api/admin/accounting/test-drafts/:id/prepare-delivery`. Tiekėjas: `GET /api/supplier/accounting/delivery-previews` tik savo įrašams.
- Administratoriaus sąskaitų peržiūroje matoma būsena ir nuorodos į PDF bei el. laiško peržiūrą.
- PDF viršuje naudojamas tas pats esamas `assets/brand/rentinorbit-logo-horizontal-dark-web.png` logotipas su R, kaip ir pačioje platformoje. PDF el. pašto adreso nespausdina.
- Tikras dokumentų išrašymas, PVM taisyklės, el. pašto gavėjo identifikavimas, tikrų PDF priedų pristatymas ir LIVE siuntimas lieka išjungti iki teisinių/apskaitos sąlygų patvirtinimo.

## V290 – apmokėtos nuomos sandorio patvirtinimas nuomininkui ir nuomotojui

- `GET /api/rentals/bookings/:bookingId/transaction-confirmation.pdf` – autentifikuotiems sandorio dalyviams, jų teisės tikrinamos pagal realų užsakymą ir nuomotojo paskyrą. Jis nepateikia dokumento neprisijungusiam asmeniui.
- Dokumentas yra neutralus **nuomos sandorio patvirtinimas**, ne RentInOrbit vardu išrašoma nuomos sąskaita faktūra. RentInOrbit komisinis yra atskiras dokumentas.
- PDF generuojamas tik už negrąžintą, apmokėtą nuomą, ne už pending, unpaid, cancelled arba refunded užsakymus.
- Naudojamas tikras platformos R logotipas, lietuviškas šriftas, užsakymo numeris, sutarties šalys, daiktas, laikotarpis ir bendra nuomos sandorio suma.
- Kai nuomotojo verslo duomenys patikrinti administratoriaus, PDF gali rodyti jo teisinį vardą; kitu atveju paliekama nuoroda į abiejų šalių nuomos sutartį, ne išgalvoti rekvizitai.
- Nuomininkas savo prisijungimo užsakymų sąraše mato PDF nuorodą tik kai užsakymas apmokėtas ir negrąžintas.
- Šis patvirtinimas nepakeičia apskaitos SF, kai pagal konkrečios šalies veiklos statusą ir teisės aktus būtinas toks dokumentas. LIVE automatinės SF, PVM ir el. pašto pristatymas toliau užblokuoti.
