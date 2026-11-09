# BDAR duomenų subjektų prašymai – staging V253 (28 punktas)

## Veikianti dalis
- `POST /api/privacy/requests` (prisijungus): `type` = `access | rectification | erasure | restriction | portability | objection`, pasirinktinis `details` iki 1000 ženklų.
- `GET /api/privacy/requests` (prisijungus): pateikia tik **dabartinės autentifikuotos paskyros** iki 50 prašymų ID, tipą, būseną ir datas; **negrąžina** laisvo teksto ir kitų asmenų prašymų.
- SQLite lentelė `privacy_subject_requests` ir indeksas. Naujos eilutės būsena `received`.
- Iki 5 prašymų per paskutines 24 valandas vienai paskyrai, per 1000 ženklų / neleistini tipai atmetami. API atsakymai `Cache-Control: no-store`.
- Nėra nesaugaus anoniminio duomenų eksporto ar momentinio trynimo.

## Privaloma prieš GO
1. Vartotojo paskyros sąsajoje parodyti prašymų pateikimą ir būsenas; nurodyti privatumo kontaktą ir neprisijungusio naudotojo prašymo kanalą.
2. Administratoriaus prieigą, tapatybės patikros procesą, atsakingą darbuotoją, saugų atsakymo kanalą ir prašymų įvykdymo auditą įdiegti atskirai. Dabartinė būsena tik `received`: **nėra automatinio apdorojimo, administratoriaus peržiūros ar pranešimo el. paštu**. Prašymai gali likti nepastebėti, kol neįdiegtas apdorojimo procesas.
3. Įvertinti pagal teisėtus tikslus ir kategorijas: naudotojų profiliai ir sesijos, skelbimai, užsakymai, žinutės, sutartys, mokėjimų identifikatoriai, grąžinimai, ginčai, apskaita, sistemos žurnalai, kopijos ir trečiosios šalys.
4. Duomenų taisymą, eksportą, apribojimą ir ištrynimą atlikti tik po tapatybės, kitų asmenų interesų ir teisinių saugojimo prievolių patikros; apsaugoti finansinį auditą bei sukčiavimo ir ginčų įrodymus. Nenumatyti automatinio Stripe trynimo.
5. Užtikrinti prašymų ir sprendimų registravimą, atsakymą paprastai per 1 mėnesį, teisėtą termino pratęsimą pranešant ir informavimą apie atsisakymo priežastis / skundą.
6. Atlikti integracinius bandymus: anonimas 401; A paskyra nemato B prašymų; netinkama įvestis 400; limitas 429; nėra slapukų / PII nutekėjimo; išlikimas po staging perkrovimo.
7. Patikrinti, ar šios lentelės duomenims priskirtas adekvatus saugojimo ir išvalymo terminas bei duomenų bazės atsarginių kopijų politika.

**Statusas:** dalinis backend įdiegimas, **NO-GO**. Production, main, LIVE Stripe ir /data nekeisti.

## V254 papildymas – naudotojo ir administratoriaus sąsajos
- Puslapio apačioje yra „Mano duomenų teisės“ mygtukas, atveriantis lietuvišką dialogą. Prisijungus galima pateikti prašymą ir peržiūrėti tik savo prašymų būsenas.
- Administratorius (tik serverio autorizuotas vaidmuo `admin`) gali peržiūrėti registruotus prašymus, jų aprašymus ir keisti jų būsenas.
- Būsenų keitimai saugomi `privacy_subject_request_audit` su administratoriaus ID, ankstesne / nauja būsena ir laiku.
- Užbaigimas / atmetimas reikalauja `reviewConfirmed`, bet **tai tik administratoriaus patvirtinimas** ir neįrodo duomenų trynimo, eksporto, atsakymo gavimo arba tapatybės patikros.
- Naudotojo ir administratoriaus formose įrašomas tekstas rodomas per `textContent`, ne per HTML.
- Jokie automatiniai asmens duomenų trynimo, taisymo ar eksportavimo veiksmai neįdiegti.

## Dar neužtikrinta
- Nėra pranešimo administratoriui apie naują prašymą ir termino kontrolės – prieš atveriant paslaugą viešai būtina įdiegti veikiantį informavimo / peržiūros procesą.
- Nėra įrodymų / dokumentų prijungimo prie bylos, tapatybės patvirtinimo, atsakymo registravimo, duomenų perdavimo saugiu kanalu bei atsakingo asmens priskyrimo.
- Būtina įvertinti atskirus duomenų saugojimo terminus, retenkciją, vidinę tvarką, teisėtus pagrindus ir procesą neprisijungusiems naudotojams.
- Šaltinio kodo patikros neužtikrina integracinio 401/403, kryžminės paskyros atskyrimo ir tikro e2e testo: privaloma atlikti izoliuotoje staging testinėje bazėje.

## V255 papildymas – terminai, sprendimo įrodymas ir operacinis pranešimas
- Naudotojui ir administratoriui pateikiama **orientacinė** termino data: registracijos data + 1 kalendorinis mėnuo. Tai nėra automatinis juridinių pratęsimų ar konkrečių terminų išimčių apskaičiavimas.
- Administratoriaus sąsajoje matomas pradelsto prašymo indikatorius.
- Užbaigti ar atmesti prašymą leidžiama tik su `reviewConfirmed=true` ir 20–2000 ženklų `resolutionNote`; note saugoma `privacy_subject_request_audit`, bet nėra tapatybės patikrinimo / realaus atsakymo patvirtinimo.
- Jei sukonfigūruotas `PRIVACY_REQUESTS_NOTIFY_EMAIL`, į bendrą `email_outbox` eilę įdedamas pranešimas be prašymo aprašymo ir asmens kontaktų. `privacy_request_notify` palaiko esamas pašto apdorojimo mechanizmas. Jei adresas arba veikiantis siuntimo worker nėra sukonfigūruotas, **pranešimo pristatymas negarantuojamas**. Numatytasis adresas tyčia nenustatomas.
- API registruoja įspėjimą, kai adresas nėra sukonfigūruotas; tai nėra pakeitimas operaciniam stebėjimui.
- Neatliekamas automatinis trynimas, taisymas ar eksportas.

**Prieš viešą GO:** sukonfigūruoti valdytojo patvirtintą adresą, veikiančią laiškų siuntimo paslaugą, terminų stebėseną / eskalavimą, realią užklausos apdorojimo ir atsakymo registravimo procedūrą. Integracinis E2E vis dar privalomas.

## V256 – administratoriaus matoma BDAR eilės būklė
- `GET /api/admin/privacy/health` yra apsaugotas sesija ir **admin** vaidmeniu. Rodo bendrus prašymų skaitiklius: gautus-neperžiūrėtus, atvirus, pradelstus ir artimiausią **orientacinę** termino datą.
- Administratoriaus dialogas šią informaciją rodo atidarius skydelį. Kai `PRIVACY_REQUESTS_NOTIFY_EMAIL`, `EMAIL_WORKER_ENABLED` ar tikra el. pašto paslauga nenustatyti, rodomas ryškus įspėjimas. Net visiems trims esant aktyviems **pristatymas nėra įrodytas**.
- Nėra automatinio skaitymo ar priminimų grafiko, nėra paskyros duomenų eksportavimo ar trynimo ir nėra viešo API, kuris rodytų kitų naudotojų prašymų kiekius.
- Testai: anonimas → 401; neadministratorius → 403; administratorius → 200; skaitikliai prieš/po prašymo; sutvarkyti ankstesnių modulių šaltinio patikros testai.
- **Operacinė būtinybė:** paskirti atsakingą asmenį, sukonfigūruoti patvirtintą el. pašto gavėją, išsiųsti saugų sintetinį bandymą ir patvirtinti tikrą pristatymą. Be to prašymai gali likti nepastebėti, jei administratorius neatidarys skydelio.
