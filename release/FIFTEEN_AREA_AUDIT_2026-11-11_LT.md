# RentInOrbit – 15 sričių techninio audito vykdymo žurnalas (2026-11-11)

**Apimtis:** `Piktoze/rentall`, `staging/v203`; Railway projektas `nurturing-strength`, aplinka `staging`. Tik vidinis techninis auditas. **Viešas paleidimas: NO-GO.**

## Vykdytos patikros ir ribos

| # | Sritis | Faktinė patikra / šaltinis | Išvada |
|---|---|---|---|
| 1 | Saugumas | `security.test.js`, `media-security.test.js`, autorizacijos ir rate-limit maršrutai, paskutinio deploy release gate | Automatinės saugos kontrolės egzistuoja; reikalingas išorinis pentestas / naršyklės testas |
| 2 | Stripe mokėjimai | `payment-ops-security.test.js`, `stripe-booking-binding-v234.test.js`, `webhook-signed-http-v231.test.js` | Automatiniai testai; tikras €100 Stripe TEST E2E vis dar nepatvirtintas |
| 3 | Sutartys ir kodai | `transfer-signature-v206.test.js`, `transfer-supplier-consent-v207.test.js` | PASS paskutiniame audituotame build; tikri dviejų paskyrų veiksmai dar būtini |
| 4 | Rolės ir prieigos | `rental-identity-boundary-v209.test.js`, `rental-http-e2e-v210.test.js` | Automatinis dviejų paskyrų API testas egzistuoja, vizualinis UI dar nepatvirtintas |
| 5 | Užsakymų būsenos | `booking-idempotency.test.js`, `rental-status-bypass-v208.test.js`, `expiration.test.js` | PASS release gate; pakartojimų ir pasibaigimo kelių regresija |
| 6 | Žinutės / ginčai | `dispute-notification-safety-v266.test.mjs`, `dispute-atomicity-v267.test.mjs` | PASS automatika; gyvas pokalbio ir ginčo E2E dar reikalingas |
| 7 | Kalbos | `localization-coverage-v203.test.mjs`, `localization-complete-v216.test.js` | Statinė vertimų aprėptis; dinaminio UI / visų kalbų naršyklės patikra atvira |
| 8 | Kalendorius | `supplier-calendar-isolation-v213.test.js`, `/api/rentals/calendar` | Izoliavimo testas; tarp 351 HTTP įrašo buvo 6 kalendoriaus HTTP 400, priežastis nepatvirtinta |
| 9 | Nuotraukos | `media-security.test.js`, `listing-photo-submit-v217.test.js` | Failų parašų tikrinimas, galerijos saugos apribojimai ir pateikimo regresija; įkėlimo naršyklėje testas laukia |
| 10 | BDAR / slapukai | `release/COOKIE_STORAGE_AUDIT_LT.md`, `release/PRIVACY_DATA_MAP_LT.md`, privacy-request regresijos | Pašalintas per platus rezervacijos diagnostikos žurnalas; galutinė naršyklės / teisinė patikra atvira |
| 11 | Automatinių testų aprėptis | `release/rc-gate.js`, `ops/audit-surface-v203.mjs` | Ištaisytas MJS ir E2E testų neįtraukimas į valdiklių audito inventorių; papildytas release testas |
| 12 | Railway infrastruktūra | `environment_status`, `describe_environment`, `get_logs` staging aplinkoje | 1 replika, atskiras 500 MB /data tomas, staging S3 bucket, sėkmingas ankstesnis build, 0 5xx paskutiniuose 351 HTTP įrašuose |
| 13 | Atsarginės kopijos | `ops/backup-and-verify.js`, `ops/test-backup-restore.js`, `backup-evidence-order-v235.test.mjs` | Patikrintas procedūros kodas, izoliuotos SQLite regresijos PASS; realaus staging atsarginės kopijos atkūrimo šiame audite nevykdyta |
| 14 | Našumas ir SEO | `performance-v181.test.js`, `index.html`, `server.js` `robots.txt` / `sitemap.xml` | Staging paieškos indeksavimas ir testinių skelbimų sitemap užblokuoti; reikalingas realus apkrovos ir mobiliųjų Web Vitals matavimas |
| 15 | Teisinis paleidimas | `release/LEGAL_LAUNCH_BLOCKERS_LT.md`, `docs/B4-LEGAL-READINESS-CHECKLIST.md` | Reikalavimų projektas; operatoriaus rekvizitai pagal susitarimą atidedami iki galo; kvalifikuotos teisinės patikros dar nėra |

## Pakeitimai šio audito metu

1. `4d2bdcaf` – visų `.mjs` ir `e2e/*.spec.*` failų įtraukimas į statinę valdiklių testų aprėptį.
2. `5557d17f` – staging atsakymams `X-Robots-Tag: noindex, nofollow, noarchive`, `robots.txt` disallow-all, staging sitemap 404.
3. `17ba9171` – apsaugų regresijos testas.
4. `8305c684` – šio testo įtraukimas į release gate; šio commit Railway build užfiksuotas PASS ir `27/27`.
5. `07093e15` – pašalintas `STAGING_BOOKING_DIAG_V1` logavimas su pristatymo adresu.
6. `e0b42d81` – papildyta logavimo negrąžinimo regresija; jos galutinis deploy būseną tikrinti atskirai.

## Privalomi likę įrodymai

- Naujasis HEAD commit turi sėkmingai baigti Railway build/deploy; PASS senesniame commit nepakanka.
- Patikrinti staging `/robots.txt`, `/sitemap.xml` ir `X-Robots-Tag` per HTTP po diegimo.
- Diagnozuoti šešias 400 kalendoriaus užklausas pagal beasmenius įvesties kriterijus ir įtraukti regresiją, jei tai UI klaida.
- Atskirame izoliuotame bandyme atlikti staging atsarginės kopijos atkūrimą ir dokumentuoti įrodymus.
- Tikras dviejų paskyrų nuomos / Stripe TEST / grąžinimo / ginčo E2E, mobilusis UX, kalbos ir juridinės peržiūros lieka **NO-GO**, kol nepatvirtinti faktiškai.

Nekeisti production, main, LIVE Stripe ir persistent /data. Visi PASS teiginiai taikomi tik nurodytiems automatiniams patikrinimams ir nereiškia viešo paleidimo leidimo.
