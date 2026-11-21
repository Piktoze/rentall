# EVRK ir užsienio paslaugų PVM – atskirti klausimai

Operatorės pateikti duomenys: Ieva Piktožė; IV pažyma 751612; veiklos kodas
775200; šiuo metu ne PVM mokėtoja. Tai nėra amžinas atleidimas nuo PVM
prievolių, SVS registracija ar tikrų sąskaitų išrašymo patvirtinimas.

## Klasifikavimas

Oficialus VDA klasifikatorius: EVRK 2.1 red., nuo 2025-01-01.
775200 atitinka 77.52.00, poklasį „Kitų materialiųjų ir nefinansinių
nematerialiųjų vertybių nuomos ir išperkamosios nuomos tarpininkavimo
paslaugų veikla“. Aprašas apima klientų ir nuomotojų suvedimą už komisinį,
naudojant skaitmeninę platformą, kai tarpininkas pats neteikia tos nuomos.

**Taikymo išvada (pagal faktinį A modelį):** šis kodas tinka RentInOrbit
tarpininkavimui. Vien dėl skaitmeninės platformos papildomo portalo kodo
nenustatyta būtinybė. Tačiau nuosavų daiktų nuoma yra atskira veikla: kodas
parenkamas pagal daiktus; pavyzdžiui, sporto ar dviračių nuomai – 77.21.00,
buitinių reikmenų kitai nuomai gali tikti 77.22.90. Automobilių, namelių ant
ratų ir priekabų nuomos tarpininkavimui atskirai numatyta 77.51.00.
Šie papildymai nėra automatiškai priskirti dabartinei platformai.

Jeigu faktiškai pradedama papildoma veikla, operatorės konkretus veiksmas:
Mano VMI → Paslaugos → Individuali veikla pagal pažymą → Individualios veiklos
pagal pažymą užsakymas, keitimas → Pildyti; pasirinkti faktinę veiklą atitinkantį
kodą. Agentas VMI registracijos nekeičia.

## Užsienio paslaugos

VMI 2025-05-01 taisyklės: perkant paslaugas, kurioms Lietuvoje taikomas
atvirkštinis PVM pagal PVMĮ 95 str. 2 d., registracijos prievolė vertinama
atskirai nuo apyvartos ribos. Mokamą talpinimą, domeną ar programinę paslaugą
reikia vertinti pagal konkretų tiekėją, pirkėjo statusą, paslaugos pobūdį ir
sąskaitoje nurodytą apmokestinimą. Ne kiekvienas užsienio mokestis vienodas.

VMI aiškiai atskiria PVM neapmokestinamas finansines paslaugas – vien tokių
paslaugų įsigijimas iš kitos ES šalies prievolės nesukuria. Todėl visiems
Stripe apdorojimo, Connect ar kitų produktų mokesčiams negalima aklai taikyti
vienodo tarifo. Stripe pats nurodo, kad vietinį reverse-charge taikymą vertina
klientas. TEST objektuose apskaičiuotas mokestis nėra reali mokama sąskaita.

Jei atitinkamos pajamos praėjusiais ir einamaisiais metais atitinka 45 000 €
sąlygą, VMI numato galimybę registruotis PVM mokėtoju, taikančiu SVS Lietuvoje:
tai leidžia neskaičiuoti PVM už tinkamus Lietuvos pardavimus, tačiau nepanaikina
prievolės dėl užsienio paslaugų. SVS automatiškai neįjungta.

Faktinių sąskaitų ir pirkimo aplinkybių vertinimas vykdomas privačiai;
pirkimo kvitai, mokėjimo nuorodos ir privatūs sąskaitų duomenys į šį viešą
repo nekeliami. Už jau įvykusius pirkimus prievolės vertinamos nuo jų datų,
ne tik nuo būsimo svetainės paleidimo. Tiekėjo jau priskaičiuoto LT PVM
negalima automatiškai sumokėti antrą kartą ar laikyti galutiniu B2B vertinimu.

Operatorės konkretus kitas veiksmas: su faktinėmis paslaugų sąskaitomis per
Mano VMI → Paklausimai arba su apskaitą tvarkančiu asmeniu patvirtinti, ar ir
nuo kada būtina registracija bei SVS, ankstesnių laikotarpių deklaravimas ir
tiekėjų sąskaitų pataisymai. Prašymo agentas nesiunčia ir registracijos nevykdo.

## Oficialūs šaltiniai (tikrinta 2026-11-21)

- VDA klasifikatorius ir datos: https://osp.stat.gov.lt/lt_LT/evrk2.1
- VDA EVRK 2.1, 77 skyriaus paaiškinimai:
  https://osp.stat.gov.lt/c/document_library/get_file?groupId=10180&uuid=6f32cfc2-e62f-4a68-aff4-1e445a36dfc6
- VMI IV papildymo kelias:
  https://www.vmi.lt/evmi/individualios-veiklos-pagal-pazyma-uzsakymas-keitimas
- VMI SVS, įskaitant finansinių paslaugų išimtį (42 klausimas):
  https://www.vmi.lt/evmi/5678
- VMI SVS deklaravimas: https://www.vmi.lt/evmi/svs-lietuvoje
- Stripe apie savo paslaugų mokesčių apmokestinimą:
  https://support.stripe.com/questions/global-taxation-of-stripe-fees?locale=en-GB

## Techninis įtvirtinimas

`operator-tax-profile.js` atskiria deklaruotą PVM statusą, veiklos kodą,
užsienio paslaugų peržiūrą ir apskaitos leidimą. Ne PVM mokėtojos statusas
neatrakina tikrų dokumentų išrašymo ir neprilyginamas 0 % PVM tarifui.
Sąskaitų planas vis dar skiria tikrą nuomotoją ir platformos komisinį.
