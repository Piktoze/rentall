# RentInOrbit — atšaukimo taisyklių naujinimas (2026-11-03)

Šaltinio bazė: ankstesnis pilnas `RentInOrbit-v196-integrated-direct-charges.zip` archyvas (2026-11-01). Šis ZIP yra **pilnas projekto šaltinių paketas**, o ne Railway aplinkoje šiuo metu veikiančių papildomų staging build/runtime pataisų eksportas. Jokio automatinio deploy nebuvo.

## Įtraukta
- Numatytoji Moderate politika: >=48 val. 100 %, 24–48 val. 75 %, 12–24 val. 50 %, <12 val. 0 %.
- `db.js`: refund formulė su centų apvalinimu; Flexible/Strict skaičiavimai nekeičiami.
- `server.js`: draudimas automatiškai atšaukti ne pending/confirmed užsakymus tikrinamas **iki Stripe iškvietimo**; papildomas serverio cancel endpoint guard aktyviems, grąžintiems ir užbaigtiems užsakymams.
- Dėl senų rezervacijų, kurios turi tik datą, automatinis atšaukimas blokuojamas nuo tos dienos 00:00 UTC. Tai konservatyvi apsauga, o ne tikslaus perdavimo laiko modelis.
- `app.js`: naujas Moderate atšaukimo tekstas skelbimo ir rezervacijos rodinyje.
- `modules/help-center-content-v177.js`: atnaujinti lietuviški ir angliški Terms/FAQ paaiškinimai.

## Testai
- `node --check server.js db.js app.js modules/help-center-content-v177.js` (kiekvienam atskirai) — OK.
- `booking-integrity.test.js`, `return-lifecycle.test.js`, `booking-date-safety.test.js` — OK.
- `customer-bookings.test.js`, `booking-portal.test.js`, `help-center-v177.test.js`, `payment-ops-security.test.js`, `dispute-lifecycle.test.js` — OK.
- Atskiras 48/24/12 val. skaičiavimo ribų testas: OK (testavimo įrankio pakete).

## Prieš staging ir LIVE būtina
1. Suderinti su Railway staging **papildomais jau naudojamais hotfixais**. Neperrašyti veikiančio staging aklai šiuo ZIP.
2. Pridėti tikslų sutartą nuomos pradžios laiką ir laiko zoną, išsaugoti jį kiekviename booking'e; tik tada 12 valandų ribos bus tiksliai apskaičiuojamos visose šalyse.
3. Susieti politikos versiją su konkrečiu booking'u (nekeisti jau priimtos senos politikos atgaline data).
4. Patikrinti Stripe *dalinių* grąžinimų ir platformos komisinio korekcijos elgesį, pakartotinį refund prašymą ir webhookus.
5. Juridiškai patvirtinti B2C, P2P, nuotolinės sutarties teises ir išimtis kiekvienoje taikytinoje šalyje.
6. Versti/validuoti papildomas lokalizacijas; šio pakeitimo LT/EN tekstai dar nėra teisinė galutinė redakcija.

Production nepakeistas; staging nepakeistas. Tai kodo artefaktas, paruoštas integracijai.
