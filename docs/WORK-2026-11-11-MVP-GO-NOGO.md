# RentInOrbit – 2026-11-11 Work vykdymo protokolas (B1–B5)

**Parengta:** 2026-11-09. **Statusas:** vykdymo instrukcija, NE įvykdytų E2E testų ataskaita.
**Tikslas:** trečiadienį vienu valdomu Work seansu atlikti likusius realius įrodymus ir priimti tik įrodymais pagrįstą GO/NO-GO. Nebeplėsti kosmetinių darbų.

## 0. Nekeičiamos ribos
- GitHub **tik** `Piktoze/rentall`, šaka `staging/v203`; Railway **tik** `nurturing-strength / staging`, URL `https://rentall-staging.up.railway.app`.
- Stripe **tik TEST/sandbox, livemode=false**. Jokio LIVE, production, `main`, `/data` pakeitimo ir realių klientų duomenų. Naujos mokamos paslaugos ir papildomų kreditų biudžetas 0 €.
- Nespausti teisinio sutikimo, paskyros atnaujinimo, neinicijuoti neaiškaus mokėjimo/refundo be reikalingo vartotojos leidimo. TEST sandoriui naudoti tik Stripe oficialią testinę kortelę, jokios tikros kortelės.
- Nevykdyti grąžinimo nepatikrinus **tikslaus** PaymentIntent, rezervacijos ir tiekėjo sąsajos; neatšaukinėti svetimų/ankstesnių €100 Stripe objektų.
- Testinės rezervacijos turi būti aiškiai pažymėtos ir atskirtos nuo kitų. Jei naudotoja turi prisijungti, leisti prisijungti pačiai; nereikalauti slaptažodžio pokalbyje.
- Pradėti nuo dabartinės GitHub/Railway būsenos, neperdiegti automatiškai, jei viskas veikia. Neuždaryti nė vieno B bloko vien statinių testų pagrindu.

## 1. Žinomi faktai ir nuorodos
- Paskutinis tikrintas commit `59bc737bc22089485713a68092a3a72fe98bacc4` (staging), Railway deploy `7ea1e5e9-cd7d-4531-b872-a027597f0946` – **SUCCESS**; release gate **27/27 PASS**. Tai **nėra** realus Chromium ar Stripe TEST E2E.
- Stripe **TEST sandbox platformos kontekstas** `acct_1UT4JCLM72MR015z`; prijungtas TEST tiekėjas `acct_1UYJrGLM72xqOs4D`. Paskutinį kartą `charges_enabled=true`, `payouts_enabled=true`, `card_payments=active`, `transfers=active`, `currently_due=[]`. Tai **nepatvirtina** susiejimo su konkrečiu staging tiekėju.
- Ankstesnis tikrinimo kandidatas `RB-1793990438974-nfe2k6`; jo tinkamumą ir autorystę būtina patikrinti. Platformos PaymentIntent paieška pagal bookingId anksčiau grąžino 0; **Direct Charge** gali būti matomas tik prijungtos paskyros kontekste.
- Ankstesnis nesusietas €100 PaymentIntent su 3 € application fee **NETINKAMAS** 15 € testui; jo neliesti.
- B1 read-only diagnostika (su teisėta **tiekėjo** staging sesija): `GET /api/stripe/connect/booking-binding/:bookingId`. Tikrinami `supplierOwnsListing`, `hasOwnerStripeConnection`, `ownerDirectChargeReady`, `loggedInStripeConnectionMatchesOwner`, `ownerStripeAccountLast4`. Jei grąžina 404/403 arba neatitikimą – **STOP**, netaisyk mokėjimo aklai.
- B1 mokėjimo kūrimo maršrutas `POST /api/payments/create-intent`; tik po supplier `confirmed`, serveris skaičiuoja kainą ir platform fee; Stripe Direct Charge kuriamas susietai paskyrai. `rentalPreauthEnabled=false` (sąmoningai išjungtas legacy hold režimas).
- B3 ankstesni Railway runtime žurnalai: S3 `database_backup_restore_check ok=true`, `integrity=ok`, 55 lentelės, migracija 184, `restoreVerified=true`; el. laiškų **pristatymas** nepatvirtintas.
- B4 operatorė turi individualią veiklą. **Jos EVRK, IV pažymos duomenis, rekvizitus ir galutinį publikavimą pagal vartotojos sprendimą atidėti iki pat galutinės stadijos**. Neskelbti išgalvotų rekvizitų.
- Kritinių blokų registras: https://github.com/Piktoze/rentall/issues/3 . Nekritiniai darbai: https://github.com/Piktoze/rentall/issues/2 .

## 2. Prieš naršyklinius veiksmus – Work preflight
1. Patikrink, kad atidarytas **staging**, o ne production; užfiksuok URL ir dabartinį commit/deploy.
2. Patikrink `GET /healthz`, `GET /api/readiness`, `GET /api/ops/status`, `GET /api/integrations/capabilities` ir atsakymo kodus; nepublikuok sesijos tokenų, Stripe paslapčių ar klientų PII. `/api/launch-readiness` gali grąžinti 503, kai galutiniai teisiniai rekvizitai nepateikti – dokumentuok tikslią priežastį, ne apeik.
3. Staging tiekėjo paskyroje patikrink Connect statusą. Prieš bet kokį mokėjimą B1 diagnostikoje patvirtink, kad tiekėjas yra rezervacijos skelbimo savininkas ir jo susietos Stripe paskyros paskutiniai keturi ID simboliai sutampa su **saugiai** patikrintu Stripe TEST kontekstu.
4. Pasirink vieną testinį €100 skelbimą (`V203 Launch Audit 100 EUR Item`, jei vis dar egzistuoja ir priklauso teisingam tiekėjui). Rinkis **atsiėmimą 0 €**, jokių +40 € pristatymo, papildomų užstatų ar kitų prekių; jei tai negalima, užfiksuok kainą ir sustok prieš mokėjimą.
5. Rask dvi **atskiras** paskyras: tiekėjo (skelbimo savininko) ir nuomininko. Jų sesijas atskirk skirtingais profilių / inkognito kontekstais. Nuomininko paskyroje neturi būti tiekėjo valdymo.

## 3. B1 – realus Stripe TEST €100 ir refundas (REZERVACIJA A)
**A paskirtis – finansinis ciklas: iki perdavimo apmokėti ir atšaukti, kad būtų galima patikrinti refundą.**
1. Nuomininkas sukuria naują aiškiai pažymėtą A rezervaciją (100 €; būsena `pending` / `unpaid`).
2. Dar prieš tiekėjo patvirtinimą bandyti pradėti mokėjimą **tik per numatytą UI**: jis turi būti neleidžiamas, o Stripe PaymentIntent neturi būti sukurtas. Jei UI siūlo neleistiną kelią – **STOP**.
3. Tiekėjas patvirtina **tą pačią A rezervaciją**. Tikėtina `confirmed` / `unpaid`.
4. Nuomininkas pradeda mokėjimą UI; patikrink, kad rodoma tiksliai **100,00 €**, o laukiamas platformos mokestis **15,00 €** TIK JEIGU realus tiekėjo planas / kainodaros snapshot patvirtina 15 % (kitu atveju dokumentuok neatitikimą ir nestumk toliau aklai).
5. Stripe TEST mokėjimas per oficialią testinę kortelę; užfiksuok **PaymentIntent ID**, `livemode=false`, EUR 10000 ct, prijungtos tiekėjo paskyros kontekstą, `application_fee_amount=1500` ct jei 15 % planas, `metadata.bookingId=A`, `purpose=rental_payment`.
6. Patikrink Stripe pasirašytą webhook per tikrą webhook gavimo įrodymą ir staging booking būseną `paid`; jei buvo sėkmingas Stripe PI, bet booking tebėra unpaid, **NO-GO**.
7. Pakartotinai atverk užsakymą/pabandyk mokėjimo kelią nekurdamas naujos transakcijos: įsitikink, kad nėra antro nuskaičiavimo / PI.
8. **Dar iki fizinio perdavimo** atšauk A per autorizuotą nuomininko/sistemos UI, laikantis rodomos atšaukimo politikos. Jei tikėtinas refundas skiriasi nuo 100 €, nevadink dalinio refundo gedimu: dokumentuok politiką ir atlik pilno grąžinimo scenarijų tik su aiškiai leistinomis sąlygomis.
9. Patikrink tikrą Stripe TEST Refund ID, būseną, sumą, sąsają su A PaymentIntent, booking `cancelled/refunded` ir idempotentiškumą (pakartotinis mygtuko paspaudimas negali sukurti antro refundo).
10. B1 PASS tik jei yra **visi** A mokėjimo, webhook, būsenos, refundo ir saugiklių įrodymai. Jei Stripe TEST apmokėjimas sėkmingas, bet refundas stringa – B1 lieka atviras, net jei HTTP testai PASS.

## 4. B2 – visas dviejų paskyrų nuomos ciklas (REZERVACIJA B)
**B paskirtis – sutartys, vienkartinis PIN, perdavimas ir grąžinimas; B nebandyti atšaukti po perdavimo.**
1. Tiekėjas turi skelbimą su **2–5 nuotraukomis**; nuomininkas jį randa paieškoje.
2. Sukuriama B rezervacija; nuomininko paskyroje ji matoma, tiekėjo paskyroje – tas pats B ID. Nei vienoje paskyroje nesimato svetimų užsakymų ar meniu.
3. Tiekėjas patvirtina, nuomininkas atsiskaito **tik TEST**, jeigu B reikalingas mokamas pilnas scenarijus. Jei rinktumeisi atskirą demonstracinį mokėjimą B, būtinai pažymėk jį kaip **demo**, ne Stripe patvirtinimą; laikyk atskirą nuo A.
4. Prieš pasirašant: **nei nuomininko, nei tiekėjo pusė neturi atskleisti perdavimo kodo**.
5. Nuomininkas patvirtina savo sutartį; patikrink, kad nebelieka pakartotinio aktyvaus „pasirašyti“ mygtuko. Iki tiekėjo sutikimo kodo negalima gauti.
6. Tiekėjas patvirtina **savo** sutartį. Tik po abiejų parašų ir būtinų mokėjimo/būsenos sąlygų nuomininko pusėje atsiranda vienkartinis atsiėmimo kodas; tiekėjas jo pats negeneruoja.
7. Tiekėjas suveda nuomininko kodą ir pažymi išdavimą. Tikėtina `active`. Tas pats kodas antrą kartą turi būti atmestas. Kodo galiojimas iki panaudojimo, ne 15 min.
8. Grąžinimą **be papildomo nuomininko kodo** patvirtina pats tiekėjas, nurodęs daikto būklę. Tikėtina `returned` / užbaigtas leidžiamas procesas.
9. Patikrink matomą galutinę būseną abiejose paskyrose, žinutes ir bent vieną ginčo pateikimo kelią, jei saugu testuoti atskiroje B ar papildomoje sintetinėje rezervacijoje. Neišgalvoti ginčo būsenos be realaus įrašo.

## 5. B3 – infrastruktūra, veikianti staging aplinka ir pranešimai
1. Railway patikrink faktinį `staging` deploy, sveikatą, privalomų kintamųjų **buvimą** (neatversk paslapčių), S3 backup `last-verified-backup.json` ir atkūrimo testo įrodymą **tik laikiname kataloge**.
2. Patikrink HTTPS ir staging domeną, naršyklėje atverk keturis viešus preflight API iš 2 skyriaus.
3. Testinėms A/B rezervacijoms patikrink, ar pranešimai iš tiesų pasiekė adresatus. `email_worker_started` nėra pristatymo įrodymas; rink arba tiekėjo/nuomininko testinių pašto dėžučių patvirtinimą, arba paslaugos pristatymo statuso įrodymą. Nesiųsti į realių klientų adresus.
4. Peržiūrėk kritines klaidas (500, kredencialų atskleidimas, sesijų/cookie saugumas). Nefiksuoti „PASS“ vien dėl to, kad serveris `ready=true`.

## 6. B4 – teisinis preflight (rekvizitus užpildyti tik paskutinėje stadijoje)
- Patikrink `/terms`, `/privacy`, `/cookies`, nuomos sutarties redakciją, tiekėjo taisykles, atšaukimą/refundą, ginčų ir vartotojo kontaktų maršrutus, fizinio asmens ir verslininko statuso atskyrimą.
- Iš anksto pasiruošk laukus: veiklos vykdytojo patvirtinti rekvizitai, IV veiklos identifikatoriai, EVRK atitiktis, kontaktinis el. paštas, adresas, galutinės privatumo duomenų saugojimo ir teisių nuostatos. **Nesugalvok jų, nepublikuok tarpinių / fiktyvių rekvizitų.**
- Vartotoja patvirtino, kad jau turi individualią veiklą, ir aiškiai nurodė EVRK / rekvizitus užpildyti **prieš pat viešą paleidimą**. Šį vieną žingsnį atidėk; visa kita gali būti suprojektuota iš anksto.
- Jei viešuose puslapiuose tebėra „nėra galutinė teisinė redakcija“, B4 lieka NO-GO mokamam viešam paleidimui. Neimituok teisinių dokumentų patvirtinimo.

## 7. B5 – privaloma baigiamoji ataskaita
Prie kiekvienos patikros nurodyk `PASS / FAIL / BLOCKED / NOT RUN` ir įrodymą (URL arba šaltinio įrašo ID, užsakymo ID, Stripe TEST PaymentIntent/Refund ID, commit, deployment, laiką). Slaptų tokenų ir pilnų asmens duomenų ataskaitoje netalpink.

| Blokas | Minimalus PASS įrodymas | 2026-11-09 žinoma būsena |
|---|---|---|
| B1 | Stripe TEST **A** €100 PI + susietas tiekėjas + tinkamas mokestis + signed webhook + booking paid + vienas refundas | Neatlikta |
| B2 | Reali **B** dviejų paskyrų naršyklės eiga, abu parašai, vienkartinis PIN, grąžinimas be antro PIN | Neatlikta |
| B3 | HTTPS, readiness/ops, DB backup+restore, realiai pristatyti testiniai laiškai | Backup+restore PASS; visa kita iš dalies |
| B4 | Galutiniai teisiniai tekstai, operatoriaus identifikacija ir reikiamas atitikimas | Rekvizitai sąmoningai atidėti |
| B5 | B1–B4 PASS, nulis kritinių neatitikimų, dokumentuotas atšaukimo / grįžimo planas | NO-GO |

### Stop taisyklės
- Jei A susiejimo diagnostika rodo ne tą tiekėją/Stripe account – **STOP**.
- Jei Stripe objektas `livemode=true`, netikėtas application fee, ne ta suma/valiuta arba užsakymas – **STOP**.
- Jei neįmanoma atskirti nuomininko/tiekėjo sesijų arba yra duomenų nuotėkis – **STOP**.
- Jei payment succeeded, bet DB/unpaid, webhook neįvyksta arba grąžinimas dvigubinasi – **NO-GO**, fiksuoti visus įrodymus.
- Jei prašomas teisinis sutikimas ar realus veiksmas, reikalingas vartotojos sprendimas – sustoti tame žingsnyje.

## 8. Tekstas perduoti į Work trečiadienį
> Tęsk RentInOrbit MVP pagal **tik** `Piktoze/rentall` `staging/v203` ir Railway `nurturing-strength / staging`. Pirmiausia atsiversk šį protokolą `docs/WORK-2026-11-11-MVP-GO-NOGO.md` bei GitHub issue #3. Vykdyk preflight, B1 rezervaciją A (tikras Stripe TEST €100 Direct Charge, webhook, 15 % tik patvirtintam planui, saugus refundas), B2 atskirą rezervaciją B (dviejų paskyrų sutartys, PIN, grąžinimas), B3 el. pašto ir readiness patikras, B4 be atidėtų IV rekvizitų ir B5 faktinę GO/NO-GO ataskaitą. Naudok valdomą naršyklę, neskelbk PASS be tikrų įrodymų. Neleisk mokėjimo iki tiekėjo patvirtinimo. Neliesk production, main, LIVE Stripe, /data, klientų duomenų; papildomas biudžetas 0 €. Jei reikės mano prisijungimo ar aiškaus sutikimo, sustok konkrečiai tame žingsnyje.

