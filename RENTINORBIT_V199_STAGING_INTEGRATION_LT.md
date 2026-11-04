# RentInOrbit v199 — pirmojo paleidimo etapo integracijos kandidatas

Data: 2026-11-03. Pagrindas: pilnas v198 ZIP.

## Kas atlikta
- Palyginti v198 pagrindinių failų Git blob SHA su GitHub `Piktoze/rentall` `main`. Jie skiriasi; todėl vien tik Railway `redeploy` senos v198 versijos neįdiegs.
- Patikrinta Railway staging tarnyba: `rentall-staging.up.railway.app`, branch `main`, paskutinis sėkmingas deploy `0b27f6bb-817a-47f7-b938-c316d11d97a5` (2026-11-02); production neliečiamas.
- Peržiūrėtas staging build/deploy režimas. Jis naudoja daug papildomų `STAGING_PATCH_*` kintamųjų. Šių pataisų turinys per šią OAuth jungtį nėra skaitomas (pasiekiami tik pavadinimai); dėl to jų saugiai negalima automatiškai sujungti su v198. Yra ir DB /data volume.
- Du pasenę statiniai testai (`payment-race.test.js` ir `refund-accounting-v107.test.js`) perrašyti į tikrinančius realų v195 Stripe Direct Charges kodą. Jie tikrina mokėjimo ir refundo idempotenciją, likučio ribą, mokėjimo terminalines būsenas ir `refund_application_fee`.
- 17 svarbiausių lokalių testų dabar praeina (įskaitant Stripe mocked direct refund); tai nėra gyvos Stripe integracijos ar naršyklės E2E įrodymas.

## Blokatoriai prieš staging deployment
1. **Nepavyko sukurti GitHub staging šakos**. GitHub jungtis grąžina `403 Resource not accessible by integration`, nors repo metaduomenys nurodo `push:true`. Naujos šakos nesukūrėme ir į main nieko neįkėlėme.
2. **Railway `STAGING_PATCH_*` kintamųjų turinys nepasiekiamas**, todėl prieš pakeičiant `buildCommand` reikia išsaugoti ir peržiūrėti jau veikiančias runtime pataisas. Negalima jų aklai panaikinti arba dėti v198 šalia, jei tos pačios eilutės / moduliai užkoduoti dar kartą.
3. **DB migracijos**: v198 prideda `rental_start_at`, `rental_start_time`, `rental_time_zone`, `cancellation_policy_snapshot`, `cancellation_policy_version`. Reikia staging SQLite backup iš `/data` ir migracijos patikrinimo, neištrinant rezervacijų.
4. **Staging E2E**: naujas skelbimas → rezervacija → tiekėjo patvirtinimas → Stripe test-mode mokėjimas → 100/75/50/0% refundai → komisinių korekcija → webhook → el. paštas, taip pat pakartotinių užklausų apsauga.
5. Visų penkių kalbų naršyklinis perėjimas ir teisinių tekstų peržiūra dar reikalingi; lokalūs testai nėra pilna LIVE garantija.

## Saugus įkėlimas (tik staging)
1. Atskirame GitHub branche iškelti pilną v199 turinį, main nekeisti; arba naudoti autorizuotą staging-only deploy kelią.
2. Susirinkti dabartinių staging hotfixų tekstus iš saugios Railway paskyros ir suderinti juos su v199 failais. Patikrinimus atlikti be secretų išrašymo į logus ar ZIP.
3. Sukurti SQLite /data atsarginę kopiją; patikrinti migracijų suderinamumą ir galimybę atkurti.
4. Paleisti lokalius statinius bei integracinius testus, tada deploy į staging; peržiūrėti deploy logus ir health.
5. Atlikti pilną E2E su Stripe test-mode; tik po jo perkelti tą pačią patikrintą kodų bazę į production atskiru aiškiu sprendimu.

**Būsena: STAGING CANDIDATE / NOT DEPLOYED / NOT LIVE READY.**
