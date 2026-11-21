# Operatorės peržiūrai: apskaitos ir saugojimo projektas

Būsena: **PROPOSED, NOT APPROVED**. Šis dokumentas neįjungia SF išrašymo,
neišduoda tikrų numerių, nekeičia PVM/VMI registracijos ir neištrina duomenų.
Patvirtinti faktai: Ieva Piktožė, IV 751612, EVRK 775200, ne PVM mokėtoja;
LT rinka; A modelis 15 % / 85 %, visi Stripe kaštai tenka platformai.

## Siūloma komisinio SF tvarka

- Viena atskira RentInOrbit serija `RIO`, formatas `RIO-2026-000001`;
  naujais metais naujas metų prefiksas ir skaitiklis. Pradėti nuo 000001
  tik patvirtinus, kad šia serija anksčiau nebuvo išrašyta dokumentų.
  Kitų operatorės veiklų sąskaitų serijų nekeisti.
- Sąskaitos ir kreditinės naudoja tą patį nuoseklų skaitiklį. Kreditinė aiškiai
  pavadinama „Kreditinė sąskaita“, nurodo pradinį dokumentą, koregavimo priežastį,
  datą ir sumą. Pradinio PDF, numerio ir sumų neperrašyti; numerio nenaudoti dar kartą.
- Numerį rezervuoti tik vienoje DB transakcijoje, su unikaliu metų/serijos/numerio
  apribojimu ir unikalia pirminės operacijos sąsaja; pakartojimas grąžina tą patį
  dokumentą. Nei PDF generavimo, nei el. laiško pakartojimas nekuria naujos SF.
  Nepavykusio numerio registrą išlaikyti su priežastimi, jo nepernaudoti.
- Siūlomas paslaugos užbaigimo momentas: patvirtintas tinkamas daikto grąžinimas,
  kai nėra ginčo/sulaikymo; SF už tarpininkavimą išrašoma nuomotojui už 15 %
  komisinį. Iš 100 EUR nuomos tai yra 15 EUR SF ir 85 EUR nuomotojo dalis.
  Stripe balansų lėšų prieinamumo vėlavimas nekeičia jau suteiktos paslaugos datos.
  Buhalterė turi patvirtinti, ar pagal sutartį paslauga nelaikoma suteikta anksčiau;
  tada dokumento data turi sekti patvirtintą taisyklę, o ne banko išmoką.
- Iki perdavimo visiškai atšaukus ir grąžinus 100 EUR, komisinis 0 EUR. Jei SF
  dar nebuvo išrašyta, jos nekurti; jei jau išrašyta, parengti susietą kreditinę
  komisinio korekciją. Dalinių refund ir ginčo baigties apskaitą peržiūrėti atskirai.
- Nerašyti „PVM 0 %“. Dabartinis pagrindas – operatorė ne PVM mokėtoja,
  todėl PVM neskaičiuojamas pagal patvirtintą faktinį statusą. SVS nėra įjungta.
- Visos nuomos dokumento išrašytojas yra faktinis nuomotojas, ne RentInOrbit.
  Platforma negali automatiškai pasirašyti ar išrašyti nuomotojo vardu be
  patvirtinto įgaliojimo ir tinkamo dokumento rūšies. Privatus ne verslininkas
  → juridinis nuomininkas lieka blokuotas iki buhalterinio/teisinio patvirtinimo;
  pasiūlymas: pradžioje šio derinio neleisti, kol suderintas sutarties, apmokėjimo
  patvirtinimo ir galimų išskaitų/deklaravimo procesas.

## Siūlomas kategorijų grafikas (dar ne automatinės taisyklės)

| Kategorija | Projektas operatorės peržiūrai | Riba |
|---|---|---|
| Įprastos užklausos | 12 mėn. po išsprendimo | Jau patvirtinta; dokumentuotas teisinis sulaikymas – išimtis |
| Uždarytos paskyros nefinansiniai profilio duomenys | Pašalinti / anonimizuoti per 30 d. patvirtinus prašymą ir užbaigus atviras nuomas | Netaikoma privalomiems finansiniams/sutarčių įrodymams; teisės į prašymą atsakymas atskirai |
| Nebevieši skelbimai ir jų nuotraukos | 90 d. po ištrynimo, jei nereikia atvirai nuomai/ginčui | Sutarčiai reikalingas minimalus įrodymas atskiriamas nuo viešos galerijos |
| Sutartys, perdavimo ir grąžinimo įrodymai | 10 metų po prievolių užbaigimo, peržiūrint apimtį ir pagrindą prieš startą | Siūlomas reikalavimų gynimo terminas, ne teiginys, kad visiems laukams toks terminas privalomas |
| Ginčo bylos | Iki galutinio išsprendimo; tada individuali peržiūra ir taikytinas sutarties/privalomas terminas | Kas 12 mėn. peržiūrėti teisinį sulaikymą; ne „amžinai“ |
| SF, kreditinės ir apskaitos registrai | Ne mažiau kaip 10 metų pagal taikomas taisykles | VMI nurodytas minimumas; atskirti nuo savanoriškų profilio duomenų |
| Infrastruktūros žurnalai | Tik pagal faktinį Railway planą ir konfigūraciją | Dabartiniame kode fizinio ištrynimo termino nekonfigūruojame ir nežadame |
| Naujos nuolatinės saugyklos kopijos | Siūloma kas 6 val., 28 naujausi bendri DB+failų rinkinių snapshot | Tai pasiūlymas, ne dabartinis įjungtas nustatymas ar garantuotos 7 dienos; išimtys ir fizinis ištrynimas atskirai |

Ištrynimo žurnale saugoti kategoriją, datą ir rezultatą, ne ištrintus duomenis.
Atkuriant kopiją pakartotinai pritaikyti vėlesnius ištrynimo prašymus prieš
leidžiant vartotojų prieigą. Teisinį sulaikymą taikyti tik būtinai apimčiai.

## Oficialiai patikrinta 2026-11-21

VMI individualios veiklos apskaita: ne mažiau kaip 10 metų dokumentams ir registrams:
https://www.vmi.lt/evmi/lt/buhalterin%C4%97s-apskaitos-tvarkymas3

VMI kreditinės sąskaitos: tęsiama išrašomų sąskaitų numeracija:
https://www.vmi.lt/evmi/apskaitos-dokumentai3

Užsienio paslaugų PVM vertinimas lieka atskiras faktinių pirkimų klausimas,
žr. `EVRK-AND-FOREIGN-VAT-2026-11-21.md`. Šis projektas jo nelaiko išspręstu.
