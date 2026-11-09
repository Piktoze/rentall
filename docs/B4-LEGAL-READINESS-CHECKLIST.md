# B4 – teisinės parengties užbaigimo kontrolė (Lietuva, MVP)

**Parengta 2026-11-09. Statusas: DRAFT / teisinės patikros planas, ne galutinė juridinė išvada.**
Tik `staging/v203`; šiame faile nieko nepublikuojama svetainės lankytojams. Operatorė nurodė, kad individualią veiklą jau turi, o jos IV/EVRK/rekvizitų įrašymą reikia atidėti **iki paskutinio paleidimo etapo**.

## Kas jau egzistuoja
- LT/EN/ES/DE/RU informacinės taisyklės, privatumo ir slapukų tekstai: `modules/help-center-content-v177.js`; maršrutai `/terms`, `/privacy`, `/cookies`, `/fees` ir `/help`.
- Privalomas paskyros registracijos sutikimas tikrinamas **serverio** lygiu (`termsAccepted=true`), o sutarties patvirtinimai saugomi atskirai tiekėjui ir nuomininkui.
- Nuomos rezervacijos sąlygos, komisiniai, atšaukimo politika ir skundų/incidentų kelias iš dalies įgyvendinti. Automatiniai testai **neprilygsta galutinei teisinei peržiūrai**.

## Ką galima suredaguoti be asmeninių rekvizitų
- [ ] **Operatoriaus ir sutarties šalių apibrėžimas.** Platformos operatorius vs. savininkas/tiekėjas vs. nuomininkas. Informacija apie verslininką ar privatų asmenį turi būti prieinama tinkamu etapu; kaip tvarkomas operatoriaus ir tiekėjo susitarimas bei nuo ko priklauso vartotojų teisės.
- [ ] **Kainos ir mokesčiai.** Prieš patvirtinant pateikti visą nuomos kainą, papildomą pristatymo mokestį (pvz., +40 € tik pasirinkus), užstatą (jeigu taikomas), mokėjimų ir grąžinimo mechaniką. 15 % platformos komisinį rodyti tik pagal realiai taikomą tiekėjo planą.
- [ ] **Atšaukimas, teisės ir grąžinimas.** Atskirk platformos sutartinį atšaukimo grafiką nuo privalomų vartotojų teisių, nepriskirk automatiškai visoms daiktų nuomoms prekės pirkimo taisyklių. Teisės atsisakyti nuotolinės sutarties taikymą / išimtis reikia įvertinti konkrečioms nuomos paslaugoms su teisininku.
- [ ] **Nuomos sutartis.** Užsakymo metu išsaugotas sąlygų snapshot: šalys, daiktas, komplektacija, data/laikas, kaina, pristatymas/atsiėmimas, sąlygos, žala, grąžinimas ir šalių atskiras sutikimas. Pasirašymo įrodymai ir jų saugojimas turi būti aptarti privatumo politikoje.
- [ ] **Ginčai ir skundai.** Aiškūs kontaktai, atsakymo eiga, įrodymų tipai, privaloma informacija apie ginčų sprendimą. Venk pažado, kad platforma automatiškai atlygina bet kokią žalą.
- [ ] **Privatumas / BDAR.** Duomenų kategorijos, tvarkymo tikslai ir atskiri teisiniai pagrindai, duomenų valdytojas/tvarkytojai, tikri gavėjai (Stripe, Railway, Resend ir kt. pagal faktines sutartis), trečiųjų šalių perdavimai, saugojimo intervalai kiekvienai duomenų klasei, duomenų subjekto teisės ir prašymų kanalas. Negalima įrašyti išgalvotų saugojimo terminų.
- [ ] **Slapukai ir išorinės technologijos.** Patikrinti tikras naršyklės užklausas į Google Fonts, Leaflet, OpenStreetMap, Stripe ir kitus; atskirti būtinas nuo nebūtinų. Jei įjungtos nebūtinos technologijos, reikia išankstinio sutikimo ir lygiaverčių „Sutinku“/„Nesutinku“ pasirinkimų bei lengvo atšaukimo. Jei tik būtinos – nenaudoti fiktyvaus sutikimo mechanizmo.
- [ ] **Prekybininko atsekamumas pagal DSA.** Prieš verslo tiekėjui siūlant paslaugas vartotojams įvertinti DSA 30 str. duomenų surinkimo ir pagrįstų patikros veiksmų reikalavimus, atsižvelgti į konkrečiai operatoriui taikomas išimtis / statusą. Vien tiekėjo savideklaracija ar Stripe KYC automatiškai nereiškia DSA įvykdymo.
- [ ] **Pagalba ir kontaktai.** Pakeisti dabartinius „kontaktas bus paskelbtas“ tekstus realiu klientų aptarnavimo kanalu ir ginčo pateikimo instrukcija. El. paštas turi būti praktiškai veikiantis.
- [ ] **Kitų kalbų versijos.** Patvirtinus LT tekstus sutikrinti kitas kalbas ir versijos datą; negalima vien kalbos pasirinkimo laikyti teisės jurisdikcijos keitimu.

## Ką sąmoningai paliekame paskutiniam etapui
- [ ] Tikri IV vykdytojo vardas/pavardė ir IV identifikacija / EVRK (tiek, kiek reikia viešai nurodyti), viešas kontaktinis adresas ir el. paštas.
- [ ] Operatoriaus mokesčių / PVM statusas ir sąskaitų išrašymo bei apskaitos organizavimas (su buhalteriu).
- [ ] Galutinės sąlygų ir privatumo politikos redakcijos patvirtinimas; „staging juodraštis“ žymos panaikinimas tik prieš viešą komercinį startą.
- [ ] Galutinis DSA / vartotojų teisių / BDAR reikalavimų taikymo patvirtinimas konkrečiam verslo modeliui. Jei privaloma išorinė teisinė peržiūra neįvykdyta, B4 lieka NO-GO.

## Faktinės esamos spragos (kodo peržiūra 2026-11-09)
- `modules/help-center-content-v177.js` LT `terms.intro`: aiškiai „nėra galutinė teisinė redakcija“.
- LT `privacy.sections`: saugojimo terminai turi būti patvirtinti; duomenų valdytojo identitetas/kontaktas turi būti pateikti.
- LT `cookies`: išorinių skriptų ir slapukų faktinis veikimas dar turi būti patikrintas.
- `server.js` / `renderPolicyPage()`: `RENTINORBIT_STAGING=true` atveju rodomas specialus juodraščio įspėjimas. **Jo nepanaikinti vien tam, kad testas rodytų gražesnį puslapį.**
- `help` kontaktų tekstuose atidėtas tikras bendros pagalbos kontaktas.

## Šaltiniai, patikrinti 2026-11-09
1. VVTAT – informacijos teikimo vartotojams reikalavimai: https://vvtat.lrv.lt/lt/informacijos-teikimo-vartotojui-reikalavimai/
2. VDAI – slapukų ir sekimo technologijų naudojimo priminimas (atnaujinta 2026-07-23): https://vdai.lrv.lt/lt/naujienos/vdai-primena-butina-uztikrinti-tinkama-slapuku-ir-kitu-sekimo-technologiju-naudojima-Xad/
3. ES Skaitmeninių paslaugų aktas (DSA), visų pirma 30 str. ir taikymo išimtys: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32022R2065
4. ES vartotojų teisių direktyvos apžvalga: https://eur-lex.europa.eu/legal-content/LT/TXT/?uri=legissum:0904_4

**Šis failas yra peržiūros planas, ne automatinis teisinis patvirtinimas.**
