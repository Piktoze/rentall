# RentInOrbit – likę paleidimo sprendimai (2026-11-22)

Privati demonstracija operatorės valdomoje TEST sesijoje paruošta. Moderavimas
(CI 45005621445), komercinių dokumentų pateikimas sintetiniame archyve
(CI 45003970150), ankstesni Stripe TEST mokėjimai ir šifruotos DB bei nuotraukos
kopijos atkūrimas jau patikrinti. Nekartoti be konkretaus pakeitimo. Svetainė
lieka privačiame TEST režime. Ribotas perjungimas pagal 4565068 atidėtas.
RIO-2026 nepanaudojimas ir startas 000001, 15/85, platformos Stripe kaštai ir
abipusio grąžinimo momentas patvirtinti. Šių sprendimų pakartotinai neprašyti.

| Kas liko | Konkretus įrodymas, po kurio uždaroma |
|---|---|
| Užsienio paslaugų PVM | Atsakymas pagal faktines tiekėjų sąskaitas: registracijos / SVS poreikis, datos, deklaracijos ir galimos pataisos. Paklausimo projektas žemiau. |
| Privatus nuomotojas → įmonė | VMI / apskaitos atsakymas dėl dokumentų, galimo GPM išskaičiavimo ir sumų. Žr. VMI-PRIVATE-LESSOR-COMPANY-QUESTION-2026-11-21.md. Ši kombinacija iki atsakymo blokuojama. |
| Apskaita ir privatumas | SF / kreditinių rekvizitų, pateikimo, saugojimo kategorijų ir teisėto intereso apimties peržiūra. Žr. FIRST-SWITCH-APPROVAL-PACKAGE-2026-11-21.md §7 ir RETENTION-BY-CATEGORY-2026-11-21.md. Tikros serijos išrašymui atskiras leidimas. |
| Zoho DPA | Esamo prašymo būsena Zoho Privacy → Data Processing Addendum ir pasirašyto dokumento įrodymas, kai procesas baigtas. Pakartotinio prašymo nekurti. |
| Saugykla ir kopijos | Patvirtintas perjungimas, nauja komercinė vieta, viešasis šifravimo raktas ir kopijų laikymo už Railway vieta. Patikrintas pirmas suplanuotas archyvas. 7 d. valymo riba taikoma po sėkmingos kopijos, ne prastovos metu. |
| LIVE nuomotojas ir webhook | Nuomotojas pildo savo Connect formą; Stripe patvirtinami paskyros reikalavimai ir pervedimų bei banko išmokų parengtis atskirai. LIVE webhook paskirtys konfigūruojamos atskiru leidimu ir patikrinamas pristatymas. Mokėjimų aktyvavimas atskiras. |

## Operatorės sprendimas dėl VMI ir kopijų parengimas

GPM išlaidoms pasirinktas 30 % būdas. Operatorės nurodymu žemiau esantys VMI
paklausimų projektai neteikiami ir tiekėjų dokumentai nesiunčiami. Užsienio
paslaugų PVM prievolė pagal faktinius pirkimus šiuo sprendimu neįvertinta.
Privataus ne verslininko nuomotojo → įmonės derinys lieka užblokuotas.
Komisinio pajamų dokumentavimo ir išrašymo kontrolė nesikeičia.

Zoho paskyra atidaryta iki prisijungimo lango. DPA būseną galima perskaityti
tik operatorės prisijungtoje paskyroje.

### Kopijų raktas vietiniame Mac terminale

Raktų porą galima sugeneruoti be repo, Node.js ir S3 prieigos. Komanda sustoja,
jei katalogas jau egzistuoja, kad neperrašytų raktų. Patikrintas OpenSSL RSA
PKCS#8 privatus ir SPKI viešasis formatas laikinoje aplinkoje.

```sh
(
  set -eu
  umask 077
  mkdir "$HOME/Documents/RentInOrbit-raktai"
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$HOME/Documents/RentInOrbit-raktai/private.pem"
  openssl pkey -in "$HOME/Documents/RentInOrbit-raktai/private.pem" -pubout -out "$HOME/Documents/RentInOrbit-raktai/public.pem"
)
```

Kopijoms reikės pasirinktos vietos už Railway ribų. Privataus rakto
nekelti į Railway ir nesiųsti pokalbyje. Tik viešasis `public.pem` naudojamas
Railway šifravimo konfigūracijai. Ši instrukcija neperjungia saugyklos ir
neįjungia kopijų grafiko.

## Nepateiktas paklausimo projektas dėl užsienio paslaugų (istorijai)

Laba diena,

Vykdau individualią veiklą Lietuvoje ir ruošiu Lietuvoje veikiančią daiktų
nuomos tarpininkavimo platformą. Šiuo metu nesu registruota PVM mokėtoja.
Veiklai naudoju užsienio tiekėjų paslaugas. Pridedu faktines sąskaitas už
domeną, talpinimą ir, jei yra, kitas mokamas paslaugas. Bent vienoje tiekėjo
sąskaitoje nurodytas Lietuvos PVM. Prašau kiekvieną pridedamą sąskaitą
įvertinti atskirai pagal paslaugą, tiekėją, pirkėjo statusą ir pirkimo datą.

1. Ar dėl kurio nors pirkimo turėjau registruotis PVM mokėtoja? Jei taip,
   nuo kurios datos ir ar galiu taikyti SVS Lietuvoje?
2. Kokias deklaracijas turėčiau pateikti už jau įvykusius pirkimus, jei
   prievolė atsirado? Kaip elgtis su tiekėjo jau priskaičiuotu Lietuvos PVM:
   ar prašyti sąskaitos pataisymo ir kaip išvengti to paties PVM dubliavimo?
3. Kaip atskirai vertinti būsimus Stripe mokėjimų apdorojimo ir Connect
   mokesčius, kai gausiu faktines sąskaitas? Kokie tiekėjo sąskaitos duomenys
   būtini teisingam vertinimui?

Prašau nurodyti, kokių papildomų duomenų reikia atsakymui.

Prieš pateikiant per Mano VMI pridėti tik faktiškai turimas sąskaitas privačiai.
Sąskaitų, banko duomenų ir prieigos paslapčių nedėti į GitHub. Juridinio
nuomininko ir privataus nuomotojo klausimą pateikti atskirai. Projektai nėra
išsiųsti.

Šaltiniai: https://www.vmi.lt/evmi/lt/pvm-moketojai ir
https://www.vmi.lt/evmi/5678. Zoho būsenų paaiškinimas:
https://help.zoho.com/portal/en/kb/accounts/manage-your-zoho-account/articles/data-processing-addendum-17-11-2026
