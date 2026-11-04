# RentInOrbit v200 – staging integracijos ir talpyklos auditas

Data: 2026-11-03. Pagrindas: v199 pilnas kodas. **Dar neįdiegta į Railway.**

## Ką pakeitėme
- Suvienodintas `?v=200` pagrindiniams HTML assetams (CSS, JS, vertimai).
- Pakeistas service worker shell cache identifikatorius į `rentinorbit-v200-shell`.
- Pakeistas service worker registracijos URL į `?v=200`.
- Atnaujintas istorinis talpyklos regresijos testas; pridėtas `cache-consistency-v200.test.cjs`.
- Pakeitimai sudėti į pilną šaltinių ZIP, bet NE į staging / production.

## Patikros
- Lokaliame paviršiniame rinkinyje: **131/142** testų praėjo. Ne visi testai praeina; tai nėra pilnas integracinis patvirtinimas.
- Nepraėję: architecture-v112.test.js, auth.test.js, availability.test.js, deployment-runtime-v147.test.js, deposit-finalization-v100.test.js, deposit-stripe-v99.test.js, expiration.test.js, full-demo-v180.test.js, production-foundation-v146.test.js, staging-mode.test.js, trust.test.js.
- Daliai nepraėjimų reikia `npm ci` priklausomybių; kiti testai tikrina pasenusius architektūros fragmentus ar schemos versiją. Klaidos turi būti ištirtos prieš LIVE.
- `node release/rc-gate.js`: **15/15 PASS**.
- `node cache-consistency-v200.test.cjs`: **PASS**.

## Railway staging situacija
- Railway staging remiasi GitHub `main`, o build metu taiko daugiau kaip keliolika `STAGING_PATCH_*` kintamųjų.
- OAuth integracija grąžina kintamųjų **pavadinimus, bet ne turinį**. Nedėkite į kitą aplinką nepatikrinę veikiančių hotfixų.
- GitHub rašymo operacija `create_branch` buvo atmesta (`403 Resource not accessible by integration`).
- Todėl nei GitHub, nei Railway veikiančios aplinkos šiuo metu nekeistos.

## Kaip saugiai diegti
1. Autorizuotoje aplinkoje patikrinti tik `STAGING_PATCH_*` tekstus, jų neviešinti ir niekada nedėti slaptažodžių / Stripe raktų į ZIP.
2. Patikrinti, ar patchai dar reikalingi v200: atlikti 3 krypčių merge (GitHub main, staging hotfixai, v200). Nepanaikinti kritinių checkout, email ir Stripe taisymų.
3. Padaryti Railway SQLite /data duomenų bazės **nuoseklią atsarginę kopiją**, įsitikinti, kad ją galima atkurti.
4. Naudoti atskirą staging šaką / diegimo kanalą. Nepakeisti `main` ir production.
5. Paleisti `npm ci`, pilną automatinių testų rinkinį, DB migracijų testus; tada staging deploy bei health patikrą.
6. Atlikti realų Stripe TEST E2E: tiekėjo patvirtinimas → €100 apmokėjimas → 100/75/50/0% refund → 15% komisija → el. laiškai, webhookai ir idempotencija. Tada patikrinti 5 kalbų naršyklinį kelią.
7. Tik po šių patikrų rengti atskirą production paleidimo sprendimą.

**Būsena: V200 ZIP SUKURTAS; STAGING NOT DEPLOYED; PRODUCTION UNCHANGED.**
