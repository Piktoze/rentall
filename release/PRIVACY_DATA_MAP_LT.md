# RentInOrbit — BDAR duomenų tvarkymo inventorius ir atviri paleidimo reikalavimai

**Būsena: NO-GO.** Šis inventorius yra techninio audito projektas, ne oficialiai patvirtinta privatumo politika ar duomenų saugojimo grafikas. Pildyti pagal realų operatorių ir tiekėjus.

| Duomenys / šaltinis | Tvarkymo tikslas | Gavėjai / vieta | Būtina prieš paleidimą |
|---|---|---|---|
| `app_users`, `app_sessions` | Paskyros ir autorizacija | RentInOrbit SQLite, Railway | Nustatyti aktyvių ir neaktyvių paskyrų terminus; sesijų galiojimą ir ištrynimo tvarką |
| `rental_bookings`, sutartys, perdavimo kodų įrašai | Nuomos vykdymas, sutarčių įrodymai | SQLite; susijusi nuomos šalis mato tik reikalingus duomenis | Nustatyti saugojimą pagal sandorio tipą, galimus ginčus ir prievoles; ištrynimo/išimčių procedūrą |
| Mokėjimo ir refund identifikatoriai, `webhook_events` | Mokėjimų suderinimas, saugumas ir auditas | Stripe ir RentInOrbit | Finansinių duomenų terminai pagal taikomą apskaitos teisę; peržiūrėti senesnius viso webhook turinio įrašus |
| `marketplace_trader_profiles`, patikros auditas | Tiekėjo atsekamumas ir teisių apsauga | Tik tiekėjo paskyra ir įgaliotas administratorius | Atskirti juridinio asmens ir fizinio asmens duomenis; pagrįsti saugojimą po atsisakymo / veiklos nutraukimo |
| Žinutės, ginčai, atsiliepimai | Komunikacija ir ginčų nagrinėjimas | Platforma, susiję dalyviai ir moderatoriai | Nustatyti terminus ir duomenų subjektų teises neatskleidžiant kitos šalies duomenų |
| Naršyklės `localStorage` | Kalba, vietiniai profilio/paieškos nustatymai | Tik naudotojo naršyklė | Peržiūrėti visus senus laukus; nebesaugoti IBAN ir mokesčių identifikatorių, išvalyti senus jų likučius |
| HTTP ir administravimo žurnalai | Diagnostika, sauga ir prieiga | Railway ir vidiniai audito įrašai | Redagavimo/šalinimo politika, IP ir užklausų ID saugojimo terminas |
| Stripe Connect ir el. pašto paslaugų tiekėjai | Mokėjimai, tiekėjų patikra ir pranešimai | Trečiųjų šalių teikėjai | Faktinės duomenų valdytojų/tvarkytojų rolės, DPA, ES/EEE perdavimų priemonės |

## Būtini sprendimai

1. Patvirtinti tikrą RentInOrbit duomenų valdytoją ir kontaktinį privatumo el. paštą bei fizinį adresą.
2. Kiekvienam tikslui patvirtinti **teisinį pagrindą** (sutartis, teisinė prievolė, teisėtas interesas ar sutikimas), duomenų kategorijas, gavėjus, saugojimo terminus arba nustatymo kriterijus.
3. Patikrinti visų naudojamų teikėjų tikrąją duomenų vietą, vaidmenis, sutartis, galimus perdavimus už EEE ir jų apsaugas. Nenumanoma, kad Stripe, Railway ar pašto tiekėjas visais atvejais yra vien tik duomenų tvarkytojas.
4. Įdiegti patikimą prieinamą procesą prašymams susipažinti, ištaisyti, perkelti, ištrinti duomenis ar apriboti tvarkymą; tapatybės patikrą ir atsakymo terminų apskaitą. **Netrinti mokėjimų ar sutarčių automatiniu veiksmu**, kol neišnagrinėtos saugojimo išimtys ir kitos sandorio šalies teisės.
5. Patikrinti slapukus, trečiųjų šalių skriptus ir nebūtino sekimo sutikimus faktiniu naršyklės testu.
6. Įvertinti duomenų saugumo kontrolę, incidentų registrą, atsargines kopijas, jų ištrynimą ir atkūrimą.
7. Teisės specialistas turi patvirtinti galutinę vartotojui rodomą lietuvišką bei kitas faktines kalbų versijas.

## Šio etapo techninė pataisa
- V251 nebeleidžia saugoti IBAN ar mokesčių ID senojo tiekėjo profilio `localStorage`; jau naršyklėje buvę laukai šalinami, kai paskyros profilis perskaitomas.
- IBAN ir mokesčių identifikatoriaus įvestys senajame profilyje išjungtos. Stripe Connect duomenys įrašomi tik per atitinkamas saugias mokėjimo paslaugų sąsajas.
- Tai **nereiškia**, kad visi seni įrašai atsarginėse kopijose buvo ištrinti, arba kad BDAR reikalavimai jau įvykdyti.

## Pirminiai teisės šaltiniai
- https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng (BDAR 5, 6, 12–22, 28, 30, 32 straipsniai)
- https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en

