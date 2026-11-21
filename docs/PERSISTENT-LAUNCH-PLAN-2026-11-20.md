# Nuolatinės saugyklos planas – neįvykdytas perjungimas

Esama `/data` bazė, failai ir istoriniai užsakymai šio darbo metu neatveriami,
nekopijuojami ir nekeičiami. Domenas ir pašto DNS nekinta. Mokamos paslaugos
neužsakomos. Šis planas yra būsimo konkretaus perjungimo pagrindas.

## Faktinė dabartinė riba

`private-test-mode.js` parenka `/tmp/rentinorbit-private-test/<run>/test.sqlite`
ir atskirą `uploads` katalogą. Perkūrus konteinerį jie gali dingti. Privati TEST
konfigūracija tyčia išjungia DB ir S3 kopijas. `sct-test-runtime.js` priima tik
TEST raktą ir laikiną bazę; jos negalima perkelti į nuolatinį diską ar perjungti į
LIVE tiesiog keičiant kintamąjį. Tai sąmoningas saugos blokatorius.

Railway staging jau turi 500 MB tomą, prijungtą `/data`. Jo išplėtimas ar naujas
paketas nebuvo užsakytas. Naujas atskiras tomas/paslauga šiame plane nekuriamas.
Esamo tomo atskiras katalogas gali išvengti naujo resurso, bet nėra pažadas, kad
faktinis Railway naudojimas bus nemokamas. Laisvos vietos ir paskyros sąnaudų
patikra būtina prieš bet kokį vėlesnį įrašymą.

## Siūlomas konkretus vėlesnis perjungimas

1. Pirmiausia užbaigti nuolatinės SCT vykdyklės įgyvendinimą pagal patikrintą
   TEST modelį: išliekantis komandų žurnalas, neapibrėžtų operacijų suderinimas,
   perkrovimo atkūrimas, atskiras TEST/LIVE susiejimas, webhook ir ginčų laikymas.
   Negalima pašalinti laikinos bazės ribojimo vien dėl GO.
2. Išlaikyti privačią prieigos apsaugą. Tik po atskiro patvirtinimo, kad leidžiama
   pradėti naudoti naują esamo tomo katalogą, sukurti `/data/launch-v1/`.
   Ankstesnių `/data` failų neatkurti ir neperrašyti. Jei tokio leidimo nėra,
   perjungimas BLOCKED. Atskiro mokamo tomo automatiškai neužsakyti.
3. Sukurti **tuščią** naują bazę `/data/launch-v1/rentinorbit.sqlite` ir naują
   `/data/launch-v1/uploads`. Laikinos TEST bazės nekopijuoti: nei sintetiniai
   užsakymai, nei TEST Stripe ID, sesijos ar OTP neturi tapti realiais duomenimis.
4. Viena SQLite rašanti replika. Pasirinkti tik vieną DB kelią:
   `DB_PATH=/data/launch-v1/rentinorbit.sqlite`, `DATABASE_URL` ir
   `RENTINORBIT_DB_PATH` tušti; `UPLOADS_DIR=/data/launch-v1/uploads`.
   Reikalinga atskirai įgyvendinta privati nuolatinė prieigos konfigūracija;
   esama `PRIVATE_TEST_ENABLED=true` šiuos kelius ignoruotų ir liktų `/tmp`.
5. Prieš atidarant registraciją patikrinti schema/integrity, privačią prieigą,
   naujo failo įkėlimą ir jo hash po tikro Railway perkūrimo. Vien vietinis
   SQLite uždarymas ir atidarymas neįrodo Railway tomo išlikimo.
6. Naujos bazės kopijavimą įjungti tik jos atskirame prefikse ir patvirtinus
   faktinį intervalą, kopijų ribą, šifravimą, prieigos kontrolę bei ištrynimą.
   Atkūrimą tikrinti kitame laikiname kataloge. Nepritaikyti naujos retention
   taisyklės istorinių duomenų prefiksui. Failų saugyklai reikia savo kopijų
   plano – SQLite kopija neapima įkeltų nuotraukų.
7. Po teisinių/apskaitos ir Stripe parengties patvirtinimo parengti atskirą
   LIVE konfigūracijos pakeitimą galutiniam vartotojos GO. Dabartinis planas
   LIVE neįjungia ir neatlieka banko išmokos.

## Atšaukimas ir bandymo riba

Prieš pirmą realią rezervaciją galima grįžti į privačią laikiną TEST konfigūraciją.
Po pirmo realaus mokėjimo aklas DB rollback draudžiamas: pirmiausia sustabdomi
nauji veiksmai ir suderinami Stripe įvykiai bei komandų žurnalas; senesnės DB
kopijos negalima naudoti pamirštant naujesnius mokėjimus.

`persistent-storage-rehearsal.test.mjs` patikrina šviežią kanoninę schemą,
sintetinį naudotoją, atskirą failą, uždarymo/atidarymo ir kopijos vientisumą
tik laikinuose kataloguose. Tai repeticija, ne esamo tomo migracijos įrodymas.

## 2026-11-21 konkretus parengtas privatus nuolatinis TEST režimas

Šis papildymas pakeičia aukščiau nurodytą teiginį, kad privati konfigūracija
visada ignoruoja nuolatinius kelius. Numatytasis režimas toliau laikinas.
`createPersistentSctTestRuntime` naudoja tą patį tik TEST tikrinamą SCT branduolį;
LIVE raktai/objektai nepriimami. Komercinio LIVE vykdyklė ir jos vartai dėl to
nelaikomi užbaigtais. Nei naujas resursas, nei perjungimas dabar neatliktas.

Vėlesnio privataus TEST perjungimo tikslus rinkinys:

- `PRIVATE_TEST_STORAGE_MODE=persistent`;
- `PRIVATE_TEST_PERSISTENT_ROOT=/data/launch-v1`;
- išlaikyti esamą privačią OTP prieigą, TEST raktus, 1 repliką;
- nauja tuščia `/data/launch-v1/test.sqlite` ir `/data/launch-v1/uploads`;
- naujo katalogo `.rentinorbit-storage.json`:
  `{"version":1,"purpose":"fresh-private-stripe-test","runId":"<dabartinis PRIVATE_TEST_RUN_ID>","database":"test.sqlite","uploads":"uploads"}`;
- markerio `runId` nėra slaptažodis; jis susieja paruoštą saugyklą su būtent
  šiuo bandymu. Simbolinės nuorodos ir neįtrauktų senų mokėjimų istorija atmetama.

Ši parinktis **neskirta tikriems klientams ar LIVE**. Būsimam komerciniam startui
naudoti naują atskirą saugyklos versiją ir LIVE objektų susiejimą; šio TEST katalogo
ar sintetinių duomenų nekonvertuoti į LIVE. Iki perjungimo būtina patikrinti
laisvą esamo tomo vietą ir naudojimo sąnaudas, neįsigyjant jokio naujo plano.

### Suderinta kopija ir atkūrimas (pasiūlymas, ne įjungta konfigūracija)

1. Užblokuoti naujas rašančias užklausas ir pristabdyti mokėjimų/laiškų vykdykles;
   užbaigti vykstančius veiksmus, pažymėti neapibrėžtus žurnale. Išsaugoti tikslią
   kodo versiją ir neslaptos konfigūracijos kontrolinį rinkinį.
2. SQLite backup API sukurti vientisą naujos bazės kopiją; nekopijuoti vien
   aktyvaus `.sqlite` failo ignoruojant WAL. To paties sustabdymo lange kopijuoti
   tik naujos saugyklos uploads. Nei senos `/data` bazės, nei senų failų neliesti.
3. Manifestas: snapshot ID, UTC laikas, schema, commit, kiekvieno failo santykinis
   kelias, dydis, SHA-256. Patikrinti SQLite `integrity_check`, visus failų hash ir
   kad nuotraukų nuorodos turi atitinkamus failus. Atskiros DB ir nuotraukų kopijos
   be bendro manifesto nelaikomos viena atkurta saugykla.
4. Kopiją laikyti atskirai nuo aktyvaus katalogo ir, komerciniam režimui,
   turėti nepriklausomą kopiją už vieno tomo ribų. Naujo mokamo S3/bucket nekurti;
   jei esamas nepriklausomas tikslas neprieinamas be papildomo mokesčio, prieš
   užsakymą pateikti atskirą kainą. Vien to paties tomo kopija nėra avarijos apsauga.
5. Atkurti į atskirą izoliuotą katalogą su išjungtais Stripe/laiškais, tikrinti
   vientisumą ir ištrynimo žurnalo pakartotinį pritaikymą; užfiksuoti trukmę.
6. Tik tada trumpame perjungimo lange pakeisti kelią, paleisti vieną repliką,
   patikrinti privačią prieigą, naują įkėlimą, tikrą Railway perkūrimą ir išlikimą.

Rollback prieš tikrus mokėjimus: grąžinti ankstesnį commit ir
`PRIVATE_TEST_STORAGE_MODE=temporary`, išvalyti `PRIVATE_TEST_PERSISTENT_ROOT`,
išlaikyti tą pačią OTP apsaugą, TEST ir domeną. Naujo katalogo automatiškai netrinti.
Po tikrų mokėjimų šis rollback netinka – pirmiausia suderinti visus vėlesnius
Stripe objektus ir žurnalą, kitaip atkūrus seną DB galima pakartoti pervedimą.

Įrodymai: `sct-persistent-restart.test.mjs` tris atskirus procesus nutraukia
SIGKILL po vietinio teikėjo priėmimo ir du kartus paleidžia atkūrimą. Tikras
`ops/start.js` HTTP serveris atskirai nutraukiamas/paleidžiamas iš naujo;
paskyra, sesija ir failas išlieka, privačiai prieigai reikia naujo OTP.
Tai nėra jau įvykusio Railway tomo perjungimo ar LIVE finansinių operacijų įrodymas.
