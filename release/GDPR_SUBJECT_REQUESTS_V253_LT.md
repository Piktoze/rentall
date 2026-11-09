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
