# V266 – ginčo registravimo ir pranešimų atsparumas

## Problema
Prieš pataisą `POST /api/rentals/disputes` pirmiausia sukurdavo ginčą DB, tada sinchroniškai kurdavo pranešimus. Jei pranešimų kūrimas nepavykdavo, bendras maršruto klaidų gaudymas grąžindavo HTTP 400, nors ginčas DB jau likdavo užregistruotas. Pakartotas veiksmas galėdavo grąžinti `DISPUTE_ALREADY_OPEN` ir klaidinti naudotoją.

## Pataisa
- Ginčo įrašas sukuriamas pirmiausia, o pranešimai apdorojami `best effort` principu.
- Pranešimas nuomotojui ir nuomininkui kuriamas atskirais `try/catch`, kad vieno gavėjo problema nesustabdytų kito.
- Klaidos registruojamos be ginčo laisvo teksto ir el. pašto adresų: `rental_dispute_notification_failed`, ginčo ID, užsakymo ID, gavėjo rolė, klaidos kodas.
- Pranešimai lietuvių kalba. Juose nėra ginčo priežasties teksto – tik žinia, kad ginčas užregistruotas, ir nuoroda tikrinti užsakymą paskyroje.
- Sėkmingas API atsakymas `Cache-Control: no-store, private`.
- Šaltinio regresijos testas `dispute-notification-safety-v266.test.mjs` įtrauktas į release gate. Egzistuojantis `rental-http-e2e-v210.test.js` izoliuotoje DB tikrina ginčo sukūrimą, kitų naudotojų prieigos draudimą ir dvigubo ginčo atmetimą.

## Ribos
- Įterptos pranešimų klaidos realaus vykdymo metu nebuvo imituotos – šis scenarijus apsaugotas kodo struktūra, o ne nauju klaidos injekcijos E2E.
- Tikras naršyklės E2E su dviejų šalių paskyromis ir aktyvia pranešimų aplinka vis dar būtinas.
- Tik staging; nekeičiami main, production, LIVE Stripe ar nuolatiniai /data įrašai.
