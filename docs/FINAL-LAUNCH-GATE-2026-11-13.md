# RentInOrbit – galutinis, baigtinis paleidimo vartų protokolas (2026-11-13)

## Nepereiti prie naujų funkcijų ar kosmetinio taisymo
Tikslas: Lietuvos mokamas MVP. Šis dokumentas nėra leidimas paleisti LIVE ar atlikti nepatvirtintas operacijas. Dirbti tik `Piktoze/rentall` `staging/v203`, Railway `nurturing-strength/staging`, Stripe TEST. Nekeisti production/main/LIVE ar tiesiogiai /data.

## Patvirtinta, remiantis tikrais šios datos įrodymais
- GitHub commit `5f4b2ab87cf82147962250b929b4fad91f107365`, Railway staging deployment `5eaa24be-8780-4a23-865e-b3e5cc1104b5` = SUCCESS.
- Railway build log: `PASS release gate 27/27`, įskaitant izoliuotų refund, atšaukimo ir mokėjimo susiejimo testų suvestinę. Tai ne Stripe TEST E2E.
- Stripe TEST sandbox platforma `acct_1UT4JCLM72MR015z`, TEST tiekėjas `acct_1UYJrGLM72xqOs4D`: `charges_enabled`, `payouts_enabled`, kortelių mokėjimo ir pervedimų capability aktyvios; `currently_due=[]`.
- Platformos kontekste matytas senesnis `pi_3UWt9xLM72MR015z0mGpmBH4`: €100, 3 € application fee, metadata tuščia. Nėra įrodymo, kad tai mūsų €100/15% užsakymas; JO NELIESTI. Direct Charges prijungtoje paskyroje gali būti nematomi platformos PI sąraše.
- Staging administratoriaus TEST SF registras šios peržiūros metu buvo tuščias; tikras sąskaitų siuntimas/išrašymas išjungtas.
- Esamas `/data` volume ir staging backup bucket yra; faktinis paskutinės kopijos atkūrimas dar nepatvirtintas.

## Užbaigti tik šiuos vartus, vieną kartą
1. **B1 Stripe TEST finansinis ciklas** – nauja autorizuota €100 pickup rezervacija A, tiekėjo patvirtinimas, viena TEST kortelės įmoka, patvirtintas susietas PI `livemode=false`, €15 `application_fee_amount` ir €85 tiekėjo dalis pagal 15% planą, pasirašytas webhook, 100% refund ir antro refundo/mokėjimo blokas. Patvirtinti Stripe prijungtos paskyros ir užsakymo identiškumą; nelieskite senų objektų.
2. **B2 dviejų paskyrų UI ciklas** – atskira nauja rezervacija B, rezervacija → tiekėjo patvirtinimas → TEST mokėjimas → atskiri abiejų sutarčių patvirtinimai → perdavimo kodas pagal kiekvienos šalies teisę → perdavimas → nuomotojo patvirtintas grąžinimas. Patikrinti pranešimus ir žinutes. Reikia realaus valdomos naršyklės įrodymo; HTTP testai nepakeičia.
3. **B3 operacijos** – galutinis `/healthz`, `/api/readiness`, `/api/launch-readiness`, backup naujumo, vieno atkūrimo į atskirą laikiną katalogą (neliečiant /data), domeno ir TLS, bei realių transakcinių laiškų pristatymo patikrinimas.
4. **B4 teisė ir apskaita** – tikri operatoriaus IV, adresas ir mokesčių/ PVM statusas, teisinė platformos tarpininko rolė, 15% komisinių sąskaitos, nuomotojo sąskaitos pagal jo statusą, B2B (privatus žmogus → įmonė išlieka užblokuota, kol netvirtinta), galutinės vartotojų/tiekėjų taisyklės, privatumo, slapukų, skundų ir DSA taikymo peržiūra. Negalima laikyti TEST PDF galiojančia SF, neįjungti automatinio LIVE išrašymo be teisinio ir apskaitos patvirtinimo.
5. **B5 kritinių saugumo scenarijų kontrolė** – Stripe `charge.dispute.*` įvykiai šiuo metu tik registruojami; jų finansinės būsenos ir rezervacijos susiejimas nepatvirtintas. Prieš LIVE įrodyti, kad ginčo ir chargeback metu nevykdomas netinkamas dokumentavimas ar lėšų išmokėjimas. Jei nėra viso automatizavimo, leistinas dokumentuotas saugus rankinis blokavimo ir susitaikymo procesas su aiškia atsakomybe, tik jei nepriklausomai įvertinta kaip pakankama.
6. **B6 galutinis naršyklinis CI** – naujausio `staging/v203` Chromium run URL, commit SHA, 14/14 (ar tikras atitinkamas testų skaičius), artefaktas ir statusas; senas 13/14 nelaikomas PASS.
7. **B7 LIVE pasirengimas** – tik po 1–6; atskiras operatoriaus leidimas prieš production/LIVE, dokumentuota migracija/rollback, viešas domenas, DNS, tikri laiškai ir 1 mažos apimties prižiūrimas paleidimas.

## Sprendimo taisyklė
Dabartinis sprendimas **NO-GO**. Nepereiti prie LIVE be faktinių įrodymų kiekvienam vartui, net jei GitHub ar Railway testai žali. Atskirti „NEPATIKRINTA“ nuo „NEVEIKIA“. Nepridėti naujų launch blokatorių be išmatuojamo pavojaus pagrindiniam sandoriui, saugumui ar teisei. Nekritinius pakeitimus palikti issue #2; kritiniai – issue #3.

## Kas neįmanoma vien GitHub/Railway skaitymu
- Tikro dviejų paskyrų UI E2E be valdomos autentifikuotos naršyklės;
- Gyvo Stripe TEST mokėjimo/refundo, neįsitikinus tikru užsakymo ir Connect paskyros susiejimu;
- Savininko tapatybės, individualios veiklos, teisinio ar buhalterinio patvirtinimo vietoje savininko;
- LIVE/production aktyvavimo be atskiro aiškaus leidimo.
