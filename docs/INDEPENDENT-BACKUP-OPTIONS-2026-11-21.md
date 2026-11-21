# Atsarginių kopijų tikslas ir kaina – patikrinta 2026-11-21

## Kas jau yra

Railway `nurturing-strength / staging` inventoriuje yra gyvas privatus S3
bucket `rentinorbit-staging-backups`, regionas `iad`. Rentall turi BACKUP_S3_*
kintamųjų vardus. OAuth slepia jų reikšmes; vien vardai nėra sėkmingo įkėlimo
ar naujos atkurtos kopijos įrodymas. Paslaptys neperrašytos ir naujas tikslas
nesukurtas. Privatus TEST toliau išjungia DB/S3 kopijas.

Bucket yra atskiras nuo programos `/data` tomo ir konteinerio. Tai tinkamas
jau turimas antras saugojimo tikslas, **bet jis nėra nepriklausomas nuo Railway
paskyros, tiekėjo ar bendro paskyros blokavimo**. Vien ši vieta neuždaro tokio
nepriklausomumo reikalavimo. Esamas `ops/backup-and-verify.js` orientuotas į DB;
be bendro DB+uploads manifesto jo negalima laikyti pilnos saugyklos kopija.

## Konkretūs variantai ir kainos

| Tikslas | Saugojimas | Kiti kaštai / ribos | Sprendimas dabar |
|---|---|---|---|
| Esamas Railway bucket | 0,015 USD / GB-mėn. (30 d.; bendras naudojimas apvalinamas į viršų iki GB-mėn.) | API ir bucket egress nemokami; programos srautas į bucket kainuoja 0,05 USD/GB; taikomi bendri paskyros limitai | Naujos paslaugos nereikia, bet kopijavimo nejungiame |
| Nepriklausomas Backblaze B2, pageidautina ES regiono paskyra | Pirmi 10 GB paskyros saugojimo – nemokami; virš jų viešas PAYG tarifas nuo 6,95 USD/TB/mėn. | Įprasti A/B/C API nemokami; atkūrimo srautas iki 3× mėnesio vidutinio saugojimo nemokamas, virš jo paprastai 0,01 USD/GB. Railway upload srautas toliau mokamas | Esamos paskyros/prieigos nepatvirtinau. Paskyros nekuriu, kortelės ar mokamo plano neaktyvuoju |

Tai USD kainos prieš taikomus mokesčius; į EUR nekonvertuojama išgalvotu kursu.
Tiekėjų kainos/regionas ir jų sąlygos patikrinamos dar kartą prieš užsakymą.
Railway naudojimo kreditas gali dengti sąnaudas, tačiau laisvo kredito
nepatvirtinau ir papildomos 0 EUR kainos nežadu.

### Aiškus skaičiavimo pavyzdys

Tarkime, vienas **pilnas** DB+nuotraukų kopijos rinkinys yra 100 MB (0,1 GB),
laikome 28 rinkinius ir siunčiame 4 per dieną 30 dienų. Tai tik pavyzdys,
ne esamos `/data` dydžio matavimas. Gaunama iki 2,8 GB saugojimo ir 12 GB
programos išsiunčiamo srauto per mėnesį:

- Railway tikslas: apie 0,045 USD saugojimo (3 GB-mėn.) + 0,60 USD programos
  srauto, iš viso apie **0,65 USD/mėn.** prieš mokesčius/kreditus.
- Backblaze tikslas: **0 USD B2 saugojimo**, jei bendra paskyros apimtis lieka
  iki 10 GB, + apie **0,60 USD/mėn. Railway srauto**. Tai nėra 0 EUR visa kopija.

Didesni 500 MB pilni rinkiniai reikštų iki 14 GB saugojimo ir 60 GB upload
per mėnesį; vien Railway srautas tada būtų apie 3 USD. Su inkrementiniu
kopijavimu srautą galima mažinti, bet tokio rezultato dabar nežadame.

## Siūlomas pasirinkimas peržiūrai

Naudoti jau turimą Railway bucket kaip antrą kopiją, o nepriklausomam
atkūrimui nuo Railway paskyros – atskirą Backblaze B2 paskyrą su atskira
prieiga ir ribotu kopijų įkėlimo raktu. Prieš bet kokį aktyvavimą reikalingas
operatorės pasirinkimas dėl naujo tiekėjo, sutarties/DPA, biudžeto ir sąlygų.
Tai pasiūlymas, ne patvirtintas ar užsakytas planas.

Prieš kopijas aktyvuojant: bendras DB+uploads snapshot ir hash manifestas,
šifravimas (atskiras atkūrimo raktas), ribotos teisės, įkėlimo patikra ir
atkūrimas į izoliuotą katalogą. Neliesti istorinio bucket prefikso, nepakeisti
senų kopijų retention ir neatkurti nieko į `/data`.

Šaltiniai:
- https://docs.railway.com/storage-buckets/billing
- https://railway.com/pricing
- https://www.backblaze.com/cloud-storage/pricing
