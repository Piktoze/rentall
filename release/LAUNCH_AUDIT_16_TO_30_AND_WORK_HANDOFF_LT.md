# RentInOrbit — 16–30 paleidimo patikros ir Work perdavimo protokolas

Data: 2026-11-11. Apribojimai: tik `Piktoze/rentall` `staging/v203`, `nurturing-strength/staging`, Stripe TEST. **NO-GO** iki tikrų integracijų ir naršyklės E2E įrodymų. Saugoti tik sintetines paskyras ir anonimizuotus įrodymus. Niekada nekeisti main, production, LIVE Stripe ar persistent /data.

Žymėjimas: **CODE CHECK** – aptikta esama apsauga ar šaltinio testas; **FIX** – atlikta pataisa; **OPEN** – reikalaujama papildomo vykdymo, neįrodytas PASS.

| # | Patikra | Dabartinis įrodymas / atlikta | Ko dar reikia iki PASS |
|---|---|---|---|
| 16 | Kalendoriaus HTTP 400 | 2026-11-10 12:00 UTC užfiksuotos šešios 400; buvo ir sėkmingų 200. FIX `b5376d86`, `3a7afb83`: lokalios datos, ribų tikrinimas, išlaikoma pasirinktina pradžia; testas `supplier-calendar-local-date-v269.test.mjs`. | Atkurti konkrečius 400 parametrus sintetiniame E2E ir įrodyti, kad tai buvo blogi parametrai arba konkreti UI klaida. Iš proxy žurnalo vien statusas priežasties neįrodo. |
| 17 | API neteisėta prieiga | CODE CHECK `rental-identity-boundary-v209.test.js`, `rental-http-e2e-v210.test.js`, `account-dispute-auth.test.js`. | Dvi realios synthetic sesijos; kitos paskyros booking/messages/agreement/PIN/detail ID turi gauti 401/403/404 be duomenų nutekėjimo. |
| 18 | Vienalaikės rezervacijos | CODE CHECK `createRentalBookingAtomic` SQLite transaction ir `booking-idempotency.test.js`. | Atlikti izoliuotą 20 lygiagrečių POST vienam likusiam vienetui; tik viena rezervacija gali laimėti; atsargų likutis nekinta neteisingai. |
| 19 | Stripe ryšio sutrikimai | CODE CHECK `payment-race.test.js`, `webhook-ordering.test.js`, `stripe-delayed-webhook-cancel-v237.test.mjs`, `payment-ops-security.test.js`. | Tik Stripe TEST: atjungti / atidėti webhook izoliuotai, pakartoti mokėjimą/atšaukimą, patikrinti idempotency ir realius provider statusus. |
| 20 | Duomenys po atsijungimo | FIX `d5b07a20`: `no-store, private` taikomas ir nuomos / užsakymų / žinučių / sutarčių API; testas `private-api-cache-v270.test.mjs`. | Browser cache/back button/guest token revocation po logout, server-side 401; realus HTTP no-store per sesiją. |
| 21 | Duomenų atkūrimas | CODE CHECK `ops/test-backup-restore.js`, `ops/backup-and-verify.js` ir `backup-evidence-order-v235.test.mjs`. | Tik izoliuotame kataloge paleisti tikrą `npm run backup:restore-test`; įrodyti S3 SHA256, `PRAGMA integrity_check`, migraciją, RTO/RPO. Neištrinti /data. |
| 22 | Žinutės | CODE CHECK pokalbio API `createOrGetRentalConversation` ir `addRentalMessage`; esami autorizacijos testai. | Renter/supplier siuntimas, gavimas, draudimas trečiajai paskyrai, dvigubo paspaudimo ir ilgo teksto testas tikroje UI. |
| 23 | Nuotraukos | CODE CHECK `media-security.test.js`, `listing-photo-submit-v217.test.js`; įvedimo validacija 2–5. | Realių JPEG/PNG/WebP, suklastotų antraščių, 1/6 failų, dydžio, MIME, XSS ir upload failure testai su sintetiniais failais. |
| 24 | Vertimai | CODE CHECK `localization-coverage-v203.test.mjs`, `localization-complete-v216.test.js`. | Penkių kalbų ekranų navigacija, kalendoriai, klaidos, sutartys, skelbimų tekstų vertimo kokybė, nepersidengiančių modalių E2E. |
| 25 | Datos ir laiko juostos | FIX kaip #16; CODE CHECK `supplier-deadline-timezone-v203.test.js`, `supplier-calendar-isolation-v213.test.js`. | E2E prie UTC vidurnakčio, Euro/Vilnius DST pavasario/rudens perėjimų, užimtumo datų ribų. |
| 26 | El. laiškai | CODE CHECK `email-worker.test.js`, `email-dedupe.test.js`, `booking-email.test.js`. | Tikras TEST tiekėjas + apdorojimo eilė: duplikatai, failed/retry/dead-letter ir pristatymo patvirtinimas. |
| 27 | Apkrova | CODE CHECK `performance-v181.test.js`; FIX `66c7f80d` – pasibaigusių API rate-limit atminties įrašų valymas kas 256 užklausas; regresija `rate-limit-bucket-cleanup-v271.test.mjs`. | Izoliuotai vykdyti nedidelę saugią apkrovą (pvz., 5–10 virtualių vartotojų) prieš testinę kopiją, matuoti p95 ir SQLite užrakto klaidas. Neapkrauti su persistent /data ir neįjungti mokėjimų. |
| 28 | Pradinė įkrova | CODE CHECK CSS/JS resursai, lazy image hints, Leaflet/Google Fonts išoriniai ištekliai; #14 SEO spragos taisytos anksčiau. | Lighthouse mobile/desktop: LCP, CLS, INP, JS bundle kilobaitai; mažinti įkrovą tik gavus prieš/po įrodymus. |
| 29 | Stebėjimas | CODE CHECK Railway runtime/proxy žurnalai, `/healthz`, `/api/readiness`; redacted error logging. | Testiniai 5xx, webhook failure, email worker ir backup missed alertai; tikrinti, ar pranešimai pristatomi, be asmens duomenų. |
| 30 | Work scenarijus | Žemiau parengta tiksli veiksmų seka ir STOP sąlygos. | Įvykdyti naršyklėje, pridėti realų ekrano ir Stripe TEST įvykių įrodymą. |

## Work vykdymas – griežta seka

1. Patikrinti naujausią GitHub HEAD ir Railway aktyvų deployment commit. Jei nesutampa, STOP.
2. Prisijungti per dvi izoliuotas synthetic sesijas – nuomininkas ir tiekėjas; trečia sesija trečios šalies prieigos testams. Apsaugoti testų slaptažodžius ir slapukus nuo žurnalų.
3. Vienu testiniu skelbimu patikrinti 2–5 nuotraukas, LT kalbą, 28 dienų kalendorių, šiandienos datą ir ribinius / neteisingus intervalus; įrašyti tik anoniminius 400 klaidų ID.
4. Sukurti €100 užsakymą. Iki tiekėjo patvirtinimo Stripe PaymentIntent neturi būti apmokėtas, PIN neturi būti matomas. Tiekėjas patvirtina.
5. Abi šalys pasirašo atskirai; iki kiekvienos šalies individualaus pasirašymo jos kodas negali būti pasiekiamas. Tikrinti API ne vien mygtuką.
6. Stripe TEST mokėjimas, pasirašytas webhook, pakartotas tas pats event, neteisingas booking/payment ID, pending refund ir settled refund. Tikrinti Stripe TEST Dashboard, vieną galutinę apskaitos būseną.
7. Perdavimo kodas galioja iki panaudojimo; nuomotojas pažymi grąžinimą be grąžinimo PIN. Tikrinti visų paskyrų roles, pranešimus, žinutes ir ginčo sukūrimą.
8. Atskirai išbandyti atšaukimą **prieš** mokėjimą (refund €0), **po** mokėjimo (atitinkamas tikras Stripe refund) ir pavėluotą webhook.
9. Atsijungus iš abiejų paskyrų pakartoti privačias GET/POST ir naršyklės back/forward scenarijus. Jokio kitos paskyros PII, žinučių ar PIN.
10. Mobilieji iOS Safari / Android Chrome ir penkios kalbos; screenshot kiekvienai kritinei būsenai. Ištaisyti bugus tik staging, pakartoti release gate.
11. Užfiksuoti testinį backup restore su SHA256 ir integrity_check, nepakeičiant aktyvių duomenų.
12. Viena GO/NO-GO lentelė: kriterijus, commit SHA, deployment ID, synthetic booking ID, Stripe TEST event ID, PASS/FAIL, screenshot/log pointer. Nė vieno PASS be įrodymo.

## STOP sąlygos

Netinkamas deployment/branch; Stripe LIVE identifikatoriai; nepavykęs signature/authorization/deposit/refund invariantas; neįrodytas duomenų atskyrimas; neteisingas atsarginių kopijų tikslinis kelias; bet koks persijungimas į production. Dokumentas pats nieko nepatvirtina ir nėra leidimas viešai paleisti.

## Kitas verslo blokatorius

Operatorės IV/rekvizitai atidedami iki paskutinio etapo pagal ankstesnį susitarimą. Prieš public GO reikia galutinių galiojančių duomenų, teisinės vartotojo/DSA/BDAR patikros, TAX/DAC7 apskaitos sprendimo, produkcinio Stripe Connect atitikimo ir pranešimų teikėjo konfigūracijos.
