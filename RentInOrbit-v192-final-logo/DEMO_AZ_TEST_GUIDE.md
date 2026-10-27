# RentInOrbit v180 — A–Z demo testas

Šiame staging režime tikri pinigai nejuda. `RENTINORBIT_DEMO_PAYMENTS=true` įjungia vidinį mokėjimų simuliatorių, kuris registruoja tas pačias verslo būsenas kaip realus mokėjimų provideris.

## Pagrindinis sėkmingas scenarijus

1. Prisijunk su tiekėjo paskyra.
2. Įkelk tikrą testinį skelbimą su kaina ir, jei nori, užstatu.
3. Atsijunk ir prisijunk su kita kliento paskyra.
4. Rask skelbimą, pasirink datas ir kiekį.
5. Patikrink prieinamumą ir sukurk rezervaciją.
6. Mokėjimo bloke turi būti aiškiai pažymėta `DEMO` ir kad realūs pinigai nenuskaitomi.
7. Pasirink `Sėkmingas mokėjimas` ir apmokėk testiniu režimu.
8. `Mano užsakymuose` patikrink:
   - mokėjimas = Paid;
   - užstatas = Authorized, not charged (jei skelbime yra užstatas);
   - rezervacija laukia tiekėjo patvirtinimo.
9. Prisijunk tiekėjo paskyra ir atidaryk `Užsakymai`.
10. Patvirtink rezervaciją.
11. Pažymėk, kad daiktas perduotas klientui (`active`).
12. Po grąžinimo pažymėk gerą būklę.
13. Demo užstatas turi būti automatiškai paleistas.
14. Užbaik rezervaciją (`completed`).
15. Tiekėjo pajamose turi matytis:
   - kliento sumokėta suma;
   - platformos mokestis;
   - tiekėjo dalis;
   - payout būsena `paid`.
16. Klientas gali palikti atsiliepimą, o tiekėjas — įvertinti nuomininką.

## Atmestos kortelės scenarijus

Mokėjimo bloke pasirink `Atmesta kortelė`. Rezervacija neturi tapti apmokėta. Galima bandyti mokėjimą dar kartą su sėkmingu scenarijumi.

## Atšaukimo / refundo scenarijus

1. Atlik sėkmingą demo mokėjimą.
2. Atšauk rezervaciją pagal leidžiamą būseną.
3. Sistema turi įrašyti demo refundą pagal atšaukimo taisykles.
4. Jei užstatas buvo autorizuotas, jis turi būti paleistas.
5. Tiekėjo demo payout turi būti atšauktas.

## Sugadinimo scenarijus

Jei grąžinimas pažymimas ne kaip geros būklės, užstatas pereina į `claim_pending`. Tai sąmoningai palikta peržiūros / ginčo sprendimo etapui, kad tiekėjas negalėtų vienašališkai nuskaityti užstato be kontrolės.

## Perjungimas į realų Stripe TEST vėliau

Demo provideris yra tik staging testui. Kai bus įvesti Stripe test raktai ir baigtas Connect onboarding, `RENTINORBIT_DEMO_PAYMENTS=false` perjungs checkout į tikrą Stripe TEST mokėjimą. Live režimas nuo šio nustatymo neįsijungia.
