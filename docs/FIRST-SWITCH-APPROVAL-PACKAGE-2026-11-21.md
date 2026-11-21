# Pirmas perjungimas – vienas paketas operatorės peržiūrai

Būsena: PREPARED, NOT APPLIED. Pradėta nuo 5c97694, tęsta naujausia staging/v203.
Tik Railway nurturing-strength / staging / rentall. Šis dokumentas nėra
leidimas įjungti parametrus ar atlikti žemiau nurodytus būsimus veiksmus.

## 1. Dabartinė faktinė infrastruktūra

- Esamas rentall-volume: 500 MB, /data, iad; viena replika, npm start.
- 2026-11-21 20:54:45 Lietuvos laiku atliktas tik statfs('/data') metaduomenų
  skaitymas, neatidarant ir nekeičiant jokio /data failo:
  capacityBytes=454299648; availableBytes=438587392; freeBytes=448651264.
  Procesui prieinama 438,6 MB (418,3 MiB). Failų sistema / rezervuota vieta
  nėra tas pats, kas nominalūs 500 MB; freeBytes nėra visa programai prieinama vieta.
- Service DISK_USAGE_GB metrika buvo 0.054542336 GB; ji neprilyginta /data
  užimtumui ar laisvai vietai. Talpos išvada remiasi tiesioginiu statfs.
- Pirmam naujos tuščios DB + uploads katalogo ir onboarding-only etapui
  vietos PAKANKA. Šiame etape failų įkėlimai / užsakymai draudžiami; tai nėra
  neribotos būsimos nuotraukų apimties patvirtinimas. Prieš perjungimą dar kartą
  patikrinti >=100 MB available rezervo ir numatytą pradinę apimtį. Neplėsti
  volume ir neužsakyti naujo plano, jei šis reikalavimas nebetenkinamas.
- Faktinės efektyvios paleidimo reikšmės: legacySchedulerEnabled=false,
  encryptedSchedulerEnabled=false. Naujų ENCRYPTED_BACKUP_* aktyvavimo
  kintamųjų neįrašyta. Abi scheduler vėliavos true kartu startup atmetamos.
- Pirmojo etapo konfigūracijoje lieka tik viena iad replika ir vienas Node
  rašantis procesas. Nepridėti atskiro writer/cron proceso į tą DB/uploads.

## 2. Konkretus būsimas pakeitimų paketas

Po atskiro aiškaus patvirtinimo taikyti tik šį variantą, tame pačiame volume:

| Parametras / objektas | Būsima reikšmė |
|---|---|
| Naujas root | /data/commercial-v1 |
| DB_PATH | /data/commercial-v1/commercial.sqlite |
| UPLOADS_DIR | /data/commercial-v1/uploads |
| COMMERCIAL_SCT_STORAGE_ROOT | /data/commercial-v1 |
| Marker | .rentinorbit-commercial.json: version=1, purpose=fresh-commercial-live, platformAccount=acct_1UT4J2LlutaSFdau, policy=sct-a-15-85-v1 |
| PRIVATE_TEST_ENABLED / PRIVATE_TEST_REQUIRED | false / false; vietoje jų PRIVATŪS pilotiniai vartai žemiau |
| RENTINORBIT_SCT_TEST_RUNTIME | false |
| CONNECT_ONBOARDING_ONLY_ENABLED | true |
| CONNECT_PLATFORM_ACCOUNT_ID | acct_1UT4J2LlutaSFdau |
| CONNECT_ONBOARDING_SECRET_KEY | LIVE Connect raktas įvedamas saugioje Railway formoje, ne pokalbyje ir ne šiame faile |
| CONNECT_ONBOARDING_ACCESS_SHA256 | lokaliai sugeneruoto stipraus privataus pilotinio slaptažodžio SHA-256 |
| CONNECT_ONBOARDING_ALLOWED_EMAILS | tik operatorės patvirtintas pirmo nuomotojo adresas; tuščias sąrašas nesuteikia prieigos |
| CONNECT_BANK_READBACK_ENABLED | true |
| COMMERCIAL_SCT_RUNTIME_ENABLED | false |
| COMMISSION_ISSUANCE_ENABLED / COMMISSION_NUMBERING_ACTIVATION_APPROVED | false / false |
| RENTINORBIT_DEMO_PAYMENTS | false |
| RENTINORBIT_CATALOG_ONLY | false, kad pasiekiama pati onboarding forma; tai neatveria prieigos pašaliniams |
| EMAIL_WORKER_ENABLED | false šio pirmo etapo metu |
| BACKUP_SCHEDULER_ENABLED | false |
| ENCRYPTED_BACKUP_SINGLE_WRITER_CONFIRMED | true tik po patikrinto vienos replikos / vieno proceso fakto |
| ENCRYPTED_BACKUP_PUBLIC_KEY_PEM | tik visas public.pem turinys |
| BACKUP_S3_ENABLED | true, išsaugant dabartines bucket nuorodas / kredencialus |
| ENCRYPTED_BACKUP_SCHEDULER_ENABLED | true tik atskirai patvirtinus grafiką ir turint viešąjį raktą |
| Kopijos | esamas bucket, naujas bundles-v1/ prefiksas, kas 6 val., iki 28, iki 7 d. sėkmingo job valymo metu |

STRIPE_SECRET_KEY / STRIPE_PUBLISHABLE_KEY / STRIPE_MODE šiuo onboarding-only
etapu nepaverčiami svetainės LIVE mokėjimais: finansinis Stripe klientas
nekuriamas, neinstancijuojama komercinė vykdyklė, mutacijų vartai blokuoja
mokėjimus, transfer, refund ir admin finansinius kelius. CONNECT_* raktas yra
atskiras, skirtas onboarding / readback; jo negalima nukopijuoti į įprastą
svetainės STRIPE_SECRET_KEY. Šiam paketui LIVE webhook paskirčių nereikia ir
jų sukūrimas į paketą NEĮTRAUKTAS.

Privatūs pilotiniai vartai jau paruošti kode: be HTTP Basic prieigos visas
puslapis ir API (išskyrus read-only healthz) grąžina 401. Naršyklės saugioje
HTTPS formoje username=rentinorbit, password – operatorės lokaliai sukurtas
prieigos slaptažodis. Tai atskira prieigos paslaptis, ne Stripe raktas ir ne
normalios vartotojo paskyros slaptažodis. Po jos vis tiek reikia normalios
paskyros registracijos / prisijungimo; tik allowlist nuomotojas gali atverti
savo Connect formą. Nepatvirtintas adresas atmetamas prieš Stripe paslaugos
kvietimą. Dabartinė privataus TEST OTP prieiga nepakito, vartai neaktyvuoti.
Onboarding-only režime demo vartotojai nebesėjami.

## 3. Tiksli taikymo seka (DABAR NEVYKDOMA)

1. Užfiksuoti patvirtintą commit, visą dabartinių parametrų ir kredencialų
   nuorodų grįžimo rinkinį saugioje operatorės vietoje. Slaptų reikšmių repo
   ar pokalbyje nelaikyti. Dabartinis TEST yra laikinas /tmp režimas: žr. rollback.
2. Dar kartą patikrinti vieną repliką, availableBytes ir kad commercial-v1
   tikrai nėra naudojama. Jei jau yra – NEPERKURTI ir neperrašyti DB, o sustoti
   peržiūrai; išsaugoti galimus nuomotojų susiejimus ir komandų žurnalus.
3. Atskirai leidus sukurti tik naują commercial-v1 root, uploads ir markerį;
   naują kanoninę DB inicializuoti be demo / istorinių / TEST užsakymų. Senos
   /data DB ir istorinių katalogų neatidaryti, nekopijuoti, nemigruoti ir nešalinti.
4. Vienu suderintu diegimu pakeisti DB/nuotraukų kelius ir aktyvuoti privačius
   onboarding-only vartus. Niekada nepalikti tarpinio PRIVATE_TEST=false su
   išjungtais abiem privačios prieigos mechanizmais. Trūkstant hash startup
   atmetamas. RIO serijos į tikrą DB neimportuoti; realus išrašymas lieka false.
5. Patikrinti 401 be pilotinės prieigos, normalų prisijungimą su ja, savo
   Connect formos / būsenos prieigą ir 403 svetimam adresui. Mokėjimo / refund /
   transfer / upload / booking POST turi grąžinti 403. Vien UI ar noindex nepakanka.
6. Turint operatorės viešąjį raktą atskirai aktyvuoti naują kopijų grafiką;
   seną palikti false. Pirmas bandymas po 6 val. nuo aktyvavimo. Įrodyti
   naujos kopijos objektą / laiką / hash, parsisiųsti šifruotą failą į išorinį
   diską. Nevadinti to nauju restore bandymu – ankstesnis PASS jau išsaugotas.
7. Pirmas tikras nuomotojas pats registruojasi supplier paskyra savo patvirtintu
   adresu, Išmokos → prijungimas. Jo iniciatyva vėliau gali būti sukurtas LIVE
   recipient; šiame parengimo darbe jo nekūrėme. Asmens / banko duomenis ir
   Stripe sąlygas jis pats pildo connect.stripe.com, agentas nepasirašo.
8. Patikrinti GET /api/stripe/connect/status: teisinga platforma ir savininkas,
   LT, v2 recipient-only, stripe_transfers active ir įvykdyti reikalavimai.
   Banko konfigūracija ir faktinė banko išmoka – atskiros būsenos. Pavedimų,
   refund ar tikros banko išmokos bandymų šiame pakete nėra.
9. Toliau išlaikyti privačią prieigą ir visus finansinius vartus false. LIVE
   Snapshot webhook sukūrimas / pristatymo įrodymas, pilnas komercinis režimas
   ir tikrų dokumentų aktyvavimas – atskiras vėlesnis patvirtinimas, ne šio
   paketo automatinis tęsinys. Ankstesnis webhook planas išsaugotas.

## 4. Grįžimas į TEST

- Uždaryti pilotinius prisijungimus ir naujų Connect formų kūrimą, sustabdyti
  naują scheduler ir foninius darbus. Išsaugoti NAUJĄ komercinę DB/uploads,
  gavėjo susiejimus ir komandų žurnalus. Jų netrinti net jei mokėjimų nebuvo.
- Atkurti užfiksuotą TEST parametrų rinkinį / patikrintą commit: PRIVATE_TEST
  ENABLED/REQUIRED=true, ankstesnius allowed emails / owner / run ID, TEST
  Stripe raktų nuorodas, RENTINORBIT_SCT_TEST_RUNTIME=true, DEMO=false,
  CATALOG_ONLY=false. CONNECT_ONBOARDING_ONLY_ENABLED=false,
  COMMERCIAL_SCT_RUNTIME_ENABLED=false; abu scheduler false, BACKUP_S3_ENABLED
  false pagal privataus TEST kontraktą. Pašalinti pilotinio režimo aktyvavimą,
  ne jo duomenų saugyklą. DB/UPLOADS kelių parinkimą vėl tvarko private TEST.
- Patikrinti /__test-access, 401 be jo, paskyros prisijungimą ir Stripe TEST
  režimą. Nevykdyti naujų finansinių scenarijų be poreikio.
- /tmp TEST būsena nepersistuoja per konteinerio pakeitimą: grįžimas reiškia
  naują izoliuotą TEST bazę, o ne pažadą atkurti ankstesnius laikinus TEST
  užsakymus. Jei norima išlaikyti ir juos, prieš taikymą reikės atskirai
  patvirtinto jų eksporto; šis parengimo darbas jų nekopijavo.
- Senos /data istorijos neatkurti ant naujos commercial DB. LIVE gavėjų Stripe
  netrinti. Pakartotinai grįžtant į komercinį pilotą naudoti išsaugotą
  komercinį žurnalą / susiejimus, ne naują account kūrimo raktą ar tuščią DB.

## 5. Kopijų galiojimas: faktinė riba

Esamas rentinorbit-staging-backups bucket (t3.storageapi.dev) yra Railway
Storage Bucket. Oficialioje dokumentacijoje Bucket lifecycle configuration
nurodyta kaip NEPALAIKOMA. Todėl neveikiant programai automatinės 7 d.
expiracijos taisyklės šiai saugyklai neparuošiame ir netaikome.

Pasenusias kopijas po prastovos pašalins rentall in-process naujas scheduler:
pirmas bandymas po 6 val. nuo paleidimo; tik sukūręs naują šifruotą kopiją,
sėkmingai ją upload/download ir sutikrinęs hash, jis šalins savo bundles-v1/
failus, viršijančius 28 kopijas arba 7 d. Jei programa nepasileidžia arba
kopija nepavyksta, senos kopijos lieka. Tai operacinė retention politika,
NE griežtas fizinis 7 d. terminas prastovos metu. Operatorė turi aiškiai
priimti šią ribą; jei reikia griežto termino nepriklausomai nuo programos,
šios dalies aktyvuoti negalima kol nėra atskiro patvirtinto sprendimo.
Istoriniai prefiksai neįtraukti į valymą. Jokio DELETE dabar nevykdyta.

Šaltinis (tikrinta 2026-11-21):
https://docs.railway.com/storage-buckets.md, S3 compatibility → Not yet supported.

## 6. Vienas laikymo už Railway variantas – esamas išorinis diskas

Naudoti esamą operatorės USB / išorinį diską ir į jį tiesiai parsisiųsti
AES-256-GCM šifruotą .enc failą. Naujos paslaugos / prenumeratos nėra.
Privatus raktas – operatorės kompiuteryje ir atskiroje saugioje rakto kopijoje,
ne kartu su šifruotais archyvais vienintelėje to paties disko vietoje.
Diską po parsisiuntimo atjungti ir laikyti saugiai; turėti bent paskutinę
sėkmingą kopiją. Offline disko kopijų galiojimą operatorė tvarko pagal
patvirtintą saugojimo grafiką – Railway valymas jų fiziškai nepašalina.

Trumpi operatorės veiksmai savo Mac, rentall kataloge su Node ir dependencies:

1. node ops/download-encrypted-backup.mjs --generate-keypair "$HOME/Documents/RentInOrbit-raktai"
   Esami raktai neperrašomi. private.pem niekur nekelti ir pokalbyje nesiųsti.
2. Tik public.pem turinį pateikti Railway staging / rentall / Variables /
   ENCRYPTED_BACKUP_PUBLIC_KEY_PEM. Scheduler palikti false iki atskiro leidimo.
3. Su turima vietine S3 skaitymo prieiga ir TIKRAIS objekto / prijungto disko
   vardais:
   node ops/download-encrypted-backup.mjs --key "bundles-v1/OBJEKTAS.enc" --output "/Volumes/TAVO_DISKAS/RentInOrbit-kopijos/KOPIJA.enc"
   Jei diskas neprijungtas, nesukurti pakaitinio vietinio aplanko /Volumes.
   Privataus rakto parsisiuntimui nereikia. S3 paslaptys tik vietinėje saugioje
   aplinkoje, ne pokalbyje.
4. Pilotinei prieigai lokaliai susikurti ATSKIRĄ stiprų slaptažodį ir hash:
   node -e 'const c=require("node:crypto"),p=c.randomBytes(32).toString("base64url");console.log("Tik vietiniam naudojimui:",p);console.log("CONNECT_ONBOARDING_ACCESS_SHA256:",c.createHash("sha256").update(p).digest("hex"))'
   Slaptažodžio pokalbyje nepateikti; Railway reikia tik hash. Pirmam
   nuomotojui prieigą suteikia pati operatorė savo pasirinktu saugiu būdu.

## 7. Tikrų SF ir kreditinių peržiūros sąrašas – prieš atskirą išrašymo etapą

- Išrašytoja: Ieva Piktožė, IV 751612, patvirtintas korespondencijos adresas
  ir info@rentinorbit.com. EVRK 775200 yra veiklos kodas, ne IV numeris.
  Deklaruotas ne PVM mokėtojos statusas nėra 0 % PVM tarifas; užsienio
  paslaugų PVM prievolės tikrinamos atskirai.
- Gavėjas – tikras nuomotojas (ne nuomininkas visai nuomos sumai): faktinis
  vardas / pavadinimas, būtinas adresas ir veiklos / registracijos rekvizitai
  pagal jo statusą. Nepridėti nereikalingo asmens kodo ar išgalvotų rekvizitų.
- Paslaugos data: jau patvirtintas abiejų tinkamo grąžinimo patvirtinimas be
  neišspręsto ginčo / sulaikymo; sutikrinti su journal, išrašymo data ir
  Lietuvos metų numeracija. RIO-2026 nepanaudojimo pakartotinai neklausti.
- Suma: 100 EUR nuomos pavyzdyje tik 15 EUR platformos komisinio dokumentas,
  85 EUR nuomotojo dalis, Stripe kaštai platformai. Nuomos dokumento
  išrašytojas nustatomas pagal faktinį nuomotoją; platforma neišrašo sau 100 EUR.
- Kreditinė: nuosavas bendro skaitiklio numeris, pradinės SF numeris / data,
  priežastis, mažinama suma; originalas neperrašomas; visos kreditinės
  neviršija pradinio komisinio. Prieš SF visiškai atšaukus su nuliniu
  komisiniu komisinio dokumentas nekuriamas.
- Pateikimas: tik nuomotojui jo autentifikuotoje paskyroje, originali SF ir
  susieta kreditinė atskirai, PDF parsisiuntimas. Ateityje siunčiamo laiško
  outbox dedup ir pristatymo būsena atskiri nuo dokumento išrašymo fakto.
  Dabartinis TEST pavyzdžių endpoint nėra tikrų commission_documents
  pateikimo įgyvendinimo įrodymas. Prieš tikro išrašymo aktyvavimą dar reikia
  tikro PDF / recipient API / pateikimo grandinės patikros su projektais,
  neišrašant tikrų dokumentų. Pirmas pilotinis paketas šio etapo neaktyvuoja.

## 8. Tik likę operatorės veiksmai / sprendimai

1. Patvirtinti šį pirmą paketą: nauji katalogai tame pačiame volume, viena
   replika, privatus onboarding-only, finansiniai ir tikrų SF vartai uždaryti.
   Patvirtinimas neleidžia perrašyti senų /data failų ar kurti webhook paskirčių.
2. Patvirtinti operacinę 6 val. / 28 / 7 d. kopijų politiką su aprašyta
   prastovos riba ir offline disko kopijų grafiką; nurodyti turimą išorinį
   diską, lokaliai susikurti raktus ir pateikti tik viešąjį raktą saugioje formoje.
3. Nurodyti pirmo nuomotojo paskyros adresą allowlist; pati nustatyti pilotinę
   prieigą. LIVE Connect serverio raktą pateikti tik oficialioje Stripe /
   Railway slapto kintamojo formoje (CONNECT_ONBOARDING_SECRET_KEY), ne
   pokalbyje. Dashboard: https://dashboard.stripe.com/apikeys; minimalių
   teisių raktą prieš taikymą sutikrinti su naudojamais Connect endpoint.
   Vėliau pati / pats nuomotojas pildo oficialią Stripe formą.
4. Peržiūrėti tikrų SF/kreditinių rekvizitus ir pateikimo projektą, likusių
   duomenų kategorijų terminus. Įprastų užklausų 12 mėn. jau patvirtinti.
5. Gauti tikslų VMI / apskaitos atsakymą privataus nuomotojo → įmonės
   dokumentams / GPM; atskirai faktinių užsienio paslaugų sąskaitų PVM/SVS
   vertinimą. VMI registracija nekeičiama, klausimas agento nesiunčiamas.
6. Esamo Zoho DPA užbaigimo įrodymas / dabartinės būsenos vaizdas iš
   accounts.zoho.eu/home → Privacy → Data Processing Addendum. Naujo prašymo
   ar pakartotinio laiško nekurti; paskyros email patvirtinimas nėra DPA.

RIO-2026 pradžia 000001, bendras SF/kreditinių skaitiklis, abipusis grąžinimas
ir A modelis jau patvirtinti. Tikra serija / sąskaitos šiame pakete neaktyvuojamos.
