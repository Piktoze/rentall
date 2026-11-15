# RentInOrbit Lietuvos MVP priėmimo ir palaikymo protokolas

## Viešo katalogo priėmimas

- Patvirtinti viešo domeno maršrutą, TLS ir viešas nuorodas. Užrašyti galutinį URL ir tikrintą commit.
- Patikrinti operatorės rekvizitus, kontaktą, privatumo ir slapukų tekstus. Publikavimui naudoti tik patvirtintus skelbimus su teisėtai naudojamomis nuotraukomis.
- Patikrinti anonimines katalogo, paieškos ir skelbimo nuorodas telefone lietuviškai. Laukiantis arba atmestas skelbimas neturi būti pasiekiamas nei paieškoje, nei tiesiogine nuoroda.
- Jeigu katalogas atidaromas anksčiau už mokamas nuomas, patikrinti išjungtą rezervavimo ir mokėjimo kelią per UI bei API. Prieš viešą atidarymą savininkė patvirtina šį katalogo režimą.

## Staging priėmimas

| Dalyvis | Veiksmas | Įrodymas |
| --- | --- | --- |
| Tikrinantis nuomininkas | Prisijungti, atnaujinti puslapį, rasti skelbimą, patikrinti prieinamumą, pasirinkti nemokamą atsiėmimą ir pateikti 100 € rezervaciją | Rezervacijos ID, vaidmuo, įrenginys, commit |
| Privatus ir juridinis nuomotojai | Atskiromis sintetinėmis paskyromis sukurti skelbimą, įkelti nuotraukas, patikrinti moderavimą ir pranešimus | Skelbimo ID, sprendimo būsena, ekrano įrašas be asmens duomenų |
| Administratorius | Atmesti su priežastimi, patikrinti pakartotinį pateikimą, patvirtinti ir matyti istoriją | Sprendimo laikas ir testinio administratoriaus ID |
| Abi nuomos šalys | Patvirtinti užsakymą, atskirai patvirtinti sutartis, vieną kartą panaudoti perdavimo kodą, patvirtinti grąžinimą ir patikrinti žinutes | Sutarties versija ir būsenų išrašas be PIN, slapukų ar klientinių paslapčių |
| Finansų operatorius | Atlikti du atskirus SCT TEST ciklus, įskaitant 0 € prieš grąžinimą, vieną 85 € Transfer po jo ir kitą 100 € refund | Stripe TEST PI, Charge, Transfer, Refund ir webhook ID bei vietinių būsenų sutapimas |
| Palaikymo operatorius | Patikrinti laiškų pristatymą į kontroliuojamą pašto dėžutę, ginčo registravimą ir atkūrimo įrodymą | Pristatymo ID, ginčo atsekamumas, kopijos ir izoliuoto atkūrimo žurnalas |

Pirmosios dalyvių sesijos registruojamos kaip sintetinės. Realių naudotojų grįžtamasis ryšys žymimas tik po jų atlikto bandymo.

## Palaikymas ir paleidimo sprendimas

- Savininkė paskiria vieną palaikymo ir vieną finansų atsakingą asmenį prieš kviečiant dalyvius. Skundą susieti su rezervacijos ID ir fiksuoti gavimo laiką, problemą, atsakingą asmenį ir išsprendimo laiką.
- Mokėjimo, grąžinimo ar prieigos neatitikimo atveju sustabdyti susijusį finansinį veiksmą, sutikrinti Stripe ir serverio būseną, informuoti abi šalis kanalais, numatytais sąlygose. Saugumo arba visą srautą paveikiančios klaidos atveju sustabdyti naujų užsakymų priėmimą.
- Mokamas pilotas galimas tik patvirtinus abu SCT TEST ciklus, finansinį rezervą, Stripe sąlygas, teisinius ir apskaitos dokumentus bei atskirą savininkės leidimą. Prieš atidarant pilotą užfiksuoti CI run, Railway commit, atsarginių kopijų atkūrimą ir operacijų kontaktą.
- Viešo katalogo leidimas ir mokamo piloto leidimas fiksuojami dviem atskirais sprendimais.
