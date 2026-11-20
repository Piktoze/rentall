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
