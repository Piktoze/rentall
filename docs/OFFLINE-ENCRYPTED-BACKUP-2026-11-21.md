# Šifruotos kopijos parsisiuntimas ir laikymas už Railway

Paruošti veikiantys įrankiai; reguliarus realių duomenų kopijavimas dar
neįjungtas. Bandyme naudota tik nauja laikina kanoninė DB ir sintetinė nuotrauka.
Esama `/data` ir istoriniai saugyklos prefiksai nepasiekiami šio bandymo.

## Kaip atskirta prieiga

Vienas `.enc` failas apima nuoseklią SQLite backup API kopiją, uploads failus ir
SHA-256 manifestą. Turinys šifruojamas AES-256-GCM; atsitiktinis turinio raktas
užrakinamas operatorės RSA viešuoju raktu (OAEP-SHA256). Pakeistas failas ar
neteisingas privatus raktas negali būti atkurtas. Archyvas išpakuojamas tik
patikrinus autentiškumą; neleidžiami symlink, traversal ar restore į `/data`.

**Tik privatus raktas operatorės kompiuteryje leidžia atkurti kopiją.** Jo
nesiųsti pokalbyje, nekelti į Railway, bucket ar repo. Viešąjį raktą galima
naudoti būsimam automatiniam šifravimui Railway; privatus raktas ten nereikalingas.
Bandomasis raktas buvo laikinas ir po repeticijos pašalintas, todėl bandomasis
objektas netinka operatorės realių duomenų archyvui.

## Paprastas vietinis kelias

Operatorės kompiuteryje su šio repo įrankiais ir Node.js:

1. Vieną kartą sugeneruoti raktus naujame vietiniame kataloge:
   `node ops/download-encrypted-backup.mjs --generate-keypair /LOCAL/SAFE/rio-keys`
   Saugiai išlaikyti `private.pem` ir atskirą jo atsarginę kopiją už Railway ribų.
   Tik `public.pem` vėliau naudojamas kopijas kuriančioje pusėje.
2. Naudojant jau turimą savo Railway/S3 prieigą vietiniame terminale
   (BACKUP_S3_* reikšmės aplinkoje, ne pokalbyje), parsisiųsti vieną naujo
   `bundles-v1/` prefikso kopiją:
   `node ops/download-encrypted-backup.mjs --key bundles-v1/OBJECT.enc --output /LOCAL/SAFE/rio-backup.enc`
   Įrankis neperrašo esamo failo ir niekur nesiunčia privataus rakto.
3. Atkurti tik į naują vietinį katalogą:
   `node ops/restore-encrypted-backup.mjs --bundle /LOCAL/SAFE/rio-backup.enc --private-key /LOCAL/SAFE/rio-keys/private.pem --target /LOCAL/RESTORED-NEW`
   Po hash patikros atskirai patikrinti SQLite integrity ir programos schemą.

`/LOCAL/...` – vietos operatorės kompiuteryje, ne Railway keliai. Joks privatus
raktas neprašomas šiame pokalbyje. Be privataus rakto kopijos atkurti negalima;
ši galimybė nepriklauso nuo vėlesnės Railway paskyros prieigos, kai `.enc` jau
parsisiųstas ir laikomas atskirai.

## Ko tai dar nereiškia

- Reguliariam realių duomenų kopijavimui reikės operatorės vietinio raktų
  sukūrimo, viešojo rakto konfigūracijos, naujos leistos saugyklos ir patvirtinto grafiko.
- DB+nuotraukų vientisumui kūrimo metu rašymas turi būti pristabdytas; pateiktas
  `quiesced` argumentas nėra automatinis visų produkcinių rašytojų užrakinimas.
- Tai ne vieno mygtuko internetinė paslauga ir ne jau veikianti nuolatinė kopija.
  Naujos mokamos paslaugos ir teisių plėtimai neužsakyti.
- Repeticijos objektas turėjo unikalų `isolated-probes/backup/<run>/` prefiksą
  ir po sėkmingo tikrinimo buvo pašalintas. Senos kopijos neperrašytos / netrintos.
