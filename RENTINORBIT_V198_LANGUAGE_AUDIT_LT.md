# RentInOrbit v198 – kalbų auditas (2026-11-03)

Pagrindas: v197 pilnas projekto ZIP, ne Railway staging momentinė būsena.

## Kas pataisyta
- Vienodas `data-i18n` raktų skaičius visomis 5 kalbomis (LT / EN / ES / DE / RU).
- Trūkstamos ispanų kalbos hero mygtukų ir navigacijos / filtrų vertimo reikšmės.
- Išplėstas sisteminių žinučių, registracijos ir perdavimo, rezervacijų, mokėjimų, tiekėjų bei administratoriaus ekranų žodynas iki 769 frazių.
- Dinaminio teksto grąžinimas į kanoninę kalbą prieš perjungiant kalbas (nebestringa senas vertimas; taisomas pakartotinio renderinimo atvejis).
- Neleidžiama automatiškai versti tiekėjo įvestų skelbimų pavadinimų ir aprašymų.
- Teisinių puslapių nuorodose (`/terms`, `/privacy`, `/cookies`, `/fees`, `/help`) išsaugoma vartotojo pasirinkta kalba (`?lang=`), taip pat ir dinaminėse nuorodose.
- Sutvarkytas rimtas EN teisinių tekstų defektas: anglų `Terms/Privacy/Cookies/Fees` buvo deklaruoti, tačiau rodymui likdavo lietuviškas klonas.
- „Moderate“ 48/24/12 val. ir 100/75/50/0 % atšaukimo taisyklė vienodai aprašyta FAQ/Terms visomis penkiomis kalbomis.
- `i18n` skripto cache-busting užklausa pakeista į `?v=198`.

## Automatinių testų rezultatas
- `node i18n-v161.test.js` – PASS
- `node i18n-switch-v198.test.cjs` – PASS (visų kalbų ciklai, dinaminis tekstas, redaguotas turinys, teisinės nuorodos)
- `node language-audit-v198.test.cjs` – PASS (visi raktai, baziniai HTML ir `uiText` šaltiniai)
- `node help-center-v177.test.js` – PASS
- `node brand-integrity-v186.test.js` – PASS
- `node renter-booking-status-v190.test.js` – PASS
- `node payment-final-state-v197.test.js` – PASS
- `node cancellation-v197.test.js` – PASS
- `node deep-link-routing.test.js` – PASS
- `node --check` (atitinkami pakeisti JS ir pagrindiniai failai) – PASS

## Svarbūs apribojimai
- Šios patikros **neįrodo**, kad visos įmanomos paskyrų / tiekėjų / apmokėjimo kombinacijos vizualiai nepriekaištingos. Tikra naršyklinė E2E peržiūra kiekviena kalba dar reikalinga prieš viešą paleidimą.
- Yra sistemos pranešimų, generuojamų serverio arba integracijų, kurių vertimą ir teisinius tekstus reikia patikrinti su realiomis paskyromis.
- Techniniai žymenys (Stripe, IBAN, webhook įvykių pavadinimai, pačių kalbų pavadinimai) sąmoningai neverčiami.
- V198 ZIP **neįdiegtas** į Railway staging ar production. Staging turi papildomų runtime pataisų; prieš diegimą jas būtina integruoti ir pakartoti E2E.
