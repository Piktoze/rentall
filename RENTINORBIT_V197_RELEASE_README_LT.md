# RentInOrbit v197 — priešpaleidiminis kodas (2026-11-03)

Bazė: 2026-11-01 pilnas `RentInOrbit-v196-integrated-direct-charges.zip`, papildytas 2026-11-03 atšaukimo pataisomis. **Tai ne eksporto kopija iš Railway staging; joje gali nebūti staging runtime hotfixų.** ZIP nėra automatiškai įdiegtas.

## Įdiegta šiame archyve

1. Atšaukimo „Moderate“ ribos: ≥48 h 100 %, ≥24 h 75 %, ≥12 h 50 %, <12 h 0 %. Senoms rezervacijoms išsaugota ankstesnė versija, jei nėra naujos politikos žymos. „Flexible“ ir „Strict“ nekeistos.
2. Naujos rezervacijos formoje privaloma nurodyti nuomos pradžios valandą. Serveris skaičiuoja tikrą UTC momentą pagal tiekėjo IANA zoną ir atmeta neteisingas / DST dviprasmiškas valandas.
3. Duomenų bazėje rezervacijai išsaugomas pradžios laikas, laiko zona ir tos rezervacijos atšaukimo politikos versija. Skelbimo politikos vėlesnis keitimas neperrašo jau sutartų sąlygų.
4. Atšaukimas po perdavimo ar užbaigimo atmetamas dar iki Stripe iškvietimo. Tiekėjo atšaukimo pilna suma sulyginta Stripe ir DB.
5. Pakartotinis apmokėjimo sukūrimas po `paid/refunded` atmetamas serverio lygyje (apsauga jau buvo baziniame ZIP, išsaugota naujoje versijoje).
6. Checkout peržiūroje rodoma pasirinkta pradžios valanda ir atšaukimo politika; patikslinti Terms/FAQ LT/EN tekstai.
7. Deep-link pradinis puslapis trumpam paslepiamas kol atidaromas reikalingas ekranas. Tai mažina vizualinį mirgėjimą, **bet nėra pilnas route/state refactor**.
8. `cancellation-v197.test.js` apima ribų, senų politikų, laiko zonų bei DST atvejus.

## Neužbaigti LIVE blokatoriai — neignoruoti

- Nėra perkelti/validuoti visi esami Railway staging hotfixai ir neįvykdytas E2E po šios versijos diegimo; naują ZIP pirmiausia reikia integruoti į staging.
- Stripe TEST aplinkoje reikia praeiti naują rezervacija → supplier approve → 100% / 75% / 50% / 0% refund, partial application-fee refund, webhook ir pakartotinio cancel testus. Realūs pinigai neturi būti naudojami iki to.
- Teisiniai dokumentai yra **juodraščiai**: būtinas galutinis B2C/P2P, nuotolinio atsisakymo, privatumo, privalomų kontaktų, klientų pretenzijų ir skirtingų šalių teisės vertinimas. 12h/0% negali paneigti imperatyvių vartotojų teisių.
- Užbaigti visų palaikomų kalbų teisinius vertimus; LT ir EN copy šiame ZIP neatstoja galutinės teisinės redakcijos.
- Grąžinimo / perdavimo patvirtinimo įrodymų, kortelių 3DS, dvigubų requestų, inventory lock ir kelių tiekėjų testai turi būti atliekami realiame staging.
- Po mokėjimo mokėjimo UI likučiai, navigacijos struktūrinis refactor, mobilus checkout, Stripe Connect payouts ir komunikacijų pristatymas turi būti dar kartą pratestuoti staging.
- Konfigūracija: tikras `rentinorbit.com`, DNS/SSL, verified sender `EMAIL_FROM`, Resend, Stripe Connect live accounts, live webhook secret, saugi DB backup/restore rutina, support el. paštas, sąskaitos, privatumo ir cookie consent.
- Esami seni `payment-race.test.js` ir `full-demo-v180.test.js` turi nuo v195 seną source string/schema versijos tikrinimą ir nėra tinkami naudoti kaip naujos Stripe Direct Charges logikos įrodymas. Reikalingi atnaujinti integraciniai testai.

## Saugi diegimo seka

1. Importuoti v197 kodą į atskirą staging šaką, neprarandant dabartinių staging runtime pataisų. Jokio automatinio production deploy.
2. DB failo atsarginė kopija ir schema migration dry-run, tik tada staging deploy.
3. `node cancellation-v197.test.js`, statinės integriteto patikros, tada naršyklinis E2E su Stripe test mode.
4. Audituoti taisykles, slapukus, sutikimus ir klientų pranešimus; ištaisyti nustatytus neatitikimus.
5. Tik patvirtinus visus kritinius scenarijus atskirai svarstyti production diegimą.
