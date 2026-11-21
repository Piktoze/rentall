# Bendros DB ir nuotraukų kopijos koordinavimas – paruošta, neįjungta

## Faktinis mechanizmas ir jo ribos

Vienas Node rašantis procesas / viena Railway paslaugos replika. HTTP užklausos
įleidžiamos prieš body parser ir visus maršrutus. Async maršrutų veikimas
sekamas iki jų Promise pabaigos net klientui nutraukus ryšį. Foniniai nuomos
terminų, tiekėjų priežiūros, finansinių komandų ir laiškų darbuotojai naudoja
tą patį writer() įleidimą. Healthz išlieka tik skaitymo patikra.

Kopijos užklausa pirmiausia sustabdo NAUJŲ darbų įleidimą, sulaukia visų jau
įleistų darbų, tada įjungia tikrą paused būseną. Per ją SQLite run/get/all/
iterate mutacijų, exec, transaction ir pragma vartai atmeta neįleistą rašymą;
nuotraukų įkėlimo kelias taip pat tikrinamas ir turi HTTP lease. Tik tada
SQLite backup API kopijuoja bazę, o tos pačios sustabdytos kartos nuotraukos
patenka į manifestą. Koordinatoriaus gyvas, trumpalaikis token patvirtina, kad
active=0 ir paused=true – ne vien caller pateiktas quiesced=true.

Pristabdymas apima bendros šifruotos vietinės kopijos sukūrimą. finally visada
atlaisvina įleidimą po sėkmės ar klaidos; šifruoto failo siuntimas ir tikrinimas
S3 atliekamas jau ATNAUJINUS rašymus. Drain nepavykus per 60 s kopija nepradedama,
laukiantys nauji darbai vėl įleidžiami. Nutrūkęs visas procesas atleidžia
in-memory vartus; paleidimas iš naujo nepradeda vien dėl to pripažinti senos
kopijos nauja ir neatkuria duomenų automatiškai.

Tai ne kelių paslaugų / replikų paskirstytas užraktas. Prieš aktyvavimą būtina
patikrinti vieną Railway repliką ir drausti atskirus CLI / kitus procesus,
rašančius į tą DB ar nuotraukų vietą. ENCRYPTED_BACKUP_SINGLE_WRITER_CONFIRMED
nėra koordinatoriaus įrodymo pakaitalas: aktyvūs darbai realiai skaičiuojami,
o šis papildomas saugos parametras tik patvirtina diegimo topologiją.
Senas atskirame procese paleidžiamas DB-only scheduler turi būti išjungtas;
abiem scheduler įjungtiems kartu startup atmetamas. Dabar abu režimai nekeisti.

## Izoliuotų bandymų įrodymai

backup-write-coordination.test.mjs:
- Tikras pradėtas writer iš pradžių pakeičia SQLite į generation 1 ir laukia;
  kopija negali prasidėti iki užbaigto photo-1. Naujas generation 2 writer
  neįleidžiamas, kol bendras šifruotas failas nesukurtas. Tikrinamas abiejų
  šaltinių sutapimas ir tiesioginio neįleisto SQLite/nuotraukų rašymo atmetimas.
- Specialiai sugadintas db.backup() pašalina nepilną išvestį; laukiantis DB+
  nuotraukų writer sėkmingai tęsia, o vėlesnė kopija vėl gali būti sukurta.
- Nutrūkus HTTP klientui kopija vis tiek laukia async handlerio DB įrašo.
- Drain timeout nepradeda kopijos ir atnaujina naujų darbų įleidimą.
- Retention tikrina abu limitus ir neliečia kitų / istorinių objektų prefiksų.

Naudotos naujos laikinos bazės ir sintetiniai failai. Esama /data neatidaryta.
Ankstesnis sėkmingas Railway atkūrimo bandymas nekartotas, jo įrodymas lieka
2026-11-21-encrypted-bucket-restore.json.

## Nustatymai peržiūrai (Railway dar NEĮRAŠYTI)

- ENCRYPTED_BACKUP_SCHEDULER_ENABLED=false (vėliau tik atskirai leidus true).
- ENCRYPTED_BACKUP_PUBLIC_KEY_PEM – visas viešasis PEM, jokio privataus rakto.
- ENCRYPTED_BACKUP_SINGLE_WRITER_CONFIRMED=false, kol patikrinta topologija.
- BACKUP_SCHEDULER_ENABLED=false prieš įjungiant naują scheduler.
- Naudojama esama BACKUP_S3_* prieiga ir turimas Railway bucket.
- Intervalas 6 val.; pirmas bandymas tik po 6 val. nuo aktyvavimo, ne startup.
- Vienas rinkinys: DB + uploads + SHA-256 manifestas, AES-256-GCM, RSA-OAEP.
- Prefiksas bundles-v1/; laikoma iki 28 rinkinių IR iki 7 d. (šalinamas
  rinkinys, pažeidžiantis bent vieną ribą). Svetimi objektai nešalinami.
- Retention vyksta tik po sėkmingo upload, download ir šifruoto failo hash
  palyginimo. Nesėkminga kopija nėra pagrindas trinti ankstesnes.
- Tai vykdymo metu taikoma retention: neveikiant paslaugai S3 pats failų
  fiziškai neištrina. Griežtam fiziniam 7 d. ištrynimui dar reikėtų bucket
  lifecycle, kurio prieinamumas / nustatymai šiuo etapu nekeičiami ir nežadami.

## Raktai ir parsisiuntimas savo Mac įrenginyje

Komandos vykdomos savo kompiuteryje, rentall repo kataloge su Node.js ir jo
dependencies. Jos nebuvo vykdytos operatorės kompiuteryje.

1. Sukurti naują raktų katalogą, neperrašant ankstesnių raktų:

   node ops/download-encrypted-backup.mjs --generate-keypair "$HOME/Documents/RentInOrbit-raktai"

   private.pem pasilikti savo įrenginyje ir atskirai saugiai pasidaryti jo
   kopiją. Ne pokalbyje, ne Railway, ne tame pačiame bucket. Be jo atkurti
   duomenų neįmanoma. public.pem skirtas tik šifravimui ir gali būti viešinamas.

2. Tik public.pem turinį pateikti Railway:
   nurturing-strength → staging → rentall → Variables →
   ENCRYPTED_BACKUP_PUBLIC_KEY_PEM. Kopijuoti nuo BEGIN PUBLIC KEY iki END
   PUBLIC KEY. Mac galima naudoti:

   pbcopy < "$HOME/Documents/RentInOrbit-raktai/public.pem"

   Scheduler vėliavą palikti false. Šiuo darbu Railway reikšmės nekeičiamos.

3. Turimą S3 skaitymo prieigą nustatyti tik savo vietinio terminalo aplinkoje
   pagal BACKUP_S3_* parametrus; raktų pokalbyje nepateikti. Iš tikro sąrašo
   pasirinkti bundles-v1/...enc objektą. Finder išoriniame diske sukurti
   RentInOrbit-kopijos katalogą ir patikrinti, kad diskas tikrai prijungtas.
   Pakeisti žemiau abu žymeklius tikrais vardais (tai ne tikras disko vardas):

   node ops/download-encrypted-backup.mjs --key "bundles-v1/OBJEKTO_VARDAS.enc" --output "/Volumes/TAVO_DISKAS/RentInOrbit-kopijos/KOPIJOS_VARDAS.enc"

   Taip nėra tarpinės kopijos Downloads ar Railway programos diske.
   --output neperrašo esamo failo. Jei išorinis diskas neprijungtas, nesukurti
   jo vardu vietinio pakaitinio aplanko; sustoti ir pasirinkti tikrą diską.
   Parsisiuntimui privataus dešifravimo rakto nereikia.
