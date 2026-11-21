# LIVE webhook ir pirmas nuomotojas – tik peržiūros planas

Būsena: PREPARED, NOT APPLIED. Kodas 99ec5c6310fc75916a79eb25c2ed1bbe2a36207b,
staging/v203. Nekuriama Stripe paskirtis ar paskyra, nekeičiami Railway
kintamieji, esama /data, DNS ir production. Mokėjimai neįjungiami.

## Patvirtinta platforma ir ribos

2026-11-21 tiesioginis LIVE GET: acct_1UT4J2LlutaSFdau;
charges_enabled=true, payouts_enabled=true, details_submitted=true,
card_payments ir transfers active, currently_due/past_due/pending_verification
ir errors tušti, disabled_reason=null, viena banko sąskaita.
LIVE v1 ir v2 gavėjų sąrašai tušti. LIVE v1 webhook ir v2 event_destinations
sąrašai tušti. Tai platformos patvirtinimas, ne pirmo nuomotojo patvirtinimas.
Ankstesnė nepateiktos anketos patikra lieka istoriniame JSON nepakeista.

## Tikslus būsimos konfigūracijos projektas

Adresas: **https://rentinorbit.com/api/stripe/webhook** (POST, be www ar
nukreipimo). server.js raw JSON parser ir Stripe-Signature tikrinimas.
API snapshot versija peržiūrai: **2026-08-26.dahlia**, kuri aiškiai naudojama
server.js Stripe kliente. Prieš realų sukūrimą patikrinti, kad Workbench ją
leidžia pasirinkti ir pasirašyto snapshot schema sutampa; nekopijuoti aklai
naujausios preview versijos iš dokumentacijos.

### A. Platforma / Your account – būtina SCT finansinei grandinei

Formatas **Snapshot**, šaltinis **Your account**, LIVE acct_1UT4J2LlutaSFdau.
Tik šie commercial-sct-webhooks.js apdorojami įvykiai:

- payment_intent.succeeded
- payment_intent.payment_failed
- refund.created
- refund.updated
- refund.failed
- charge.dispute.created
- charge.dispute.updated
- charge.dispute.closed

SCT mokėjimas ir refund priklauso platformai; event.account čia neturi būti.
Komercinis handleris reikalauja livemode=true, savo naujo užsakymo susiejimo,
peržiūri Stripe objektus ir deduplikuoja event.id. Ginčas įjungia sulaikymą;
net uždarytas ginčas automatiškai neatlaisvina pervedimo.
transfer.created nėra dabartinio komercinio handlerio būtinas settlement
įvykis: pervedimo rezultatas atkuriamas iš patvarios komandos ir Stripe GET.
Nenaudoti application_fee.created kaip SCT 15 % įrodymo: komisinis yra
platformoje liekanti suma, ne Direct Charges application_fee modelis.

Pasirašymo paslaptis: tik sukūrus paskirtį Workbench → Webhooks → pasirinkta
LIVE platformos paskirtis → Signing secret / Reveal; whsec_ saugiai įrašyti
Railway nurturing-strength / staging / rentall → Variables →
**STRIPE_WEBHOOK_SECRET**. Ne repo, ne pokalbyje, ne TEST paslapties pernaudojimas.
Dabar nieko nekeisti: ši paslauga tebedirba privačiam TEST. LIVE paskirtis,
rodanti į šį dar TEST handlerį, būtų atmetama dėl režimo ir negalėtų būti
vadinama paruošta. Reikia atskiro suderinto aktyvavimo plano.

### B. Connect paskyros – stebėjimas, ne mokėjimo įrodymas

Atskira LIVE Snapshot paskirtis, šaltinis **Connected accounts**, tas pats
HTTPS URL; atskiras whsec_ → **STRIPE_CONNECT_WEBHOOK_SECRET**. Kode vardais
numatyti account.updated, account.external_account.updated, payout.paid,
payout.failed. Jie tik loguojami; nėra patvaraus banko išmokos sutikrinimo ar
nuomotojo bank-ready būsenos atnaujinimo. Vien HTTP 200 šiems įvykiams nėra
šios funkcijos įgyvendinimo įrodymas. Platformos payout įvykis taip pat nėra
nuomotojo payout įrodymas; būtinas teisingas connected account kontekstas.

Recipient sukuriamas Accounts v2. Jo tapatybės/reikalavimų/capability thin
įvykių negalima laikyti v1 account.updated pakaitalu ar siųsti į šį snapshot
handlerį: v2 event notification gavimo ir objektų retrieval kelias neįgyvendintas.
Konkretaus v2 thin endpoint ir jo įvykių sąrašo šiame plane neaktyvuoti.
Kol šis kelias neįgyvendintas, onboarding statusą patikrinti autentifikuotu
serverio GET ir Stripe Dashboard, o ne grįžimo URL ar vien žurnalo eilute.
Automatinė banko payout stebėsena lieka atskiras techninis blokatorius.

## Pristatymo priėmimo patikra (vėliau, atskirai leidus)

1. Patvirtinti naują nuolatinę LIVE duomenų saugyklą ir režimo atskyrimą;
   privataus TEST paslapčių nekeisti LIVE paslaptimis kol vyksta TEST bandymai.
2. Patikrinti tiesioginį HTTPS POST URL, be redirect ir privataus prisijungimo
   slapuko reikalavimo. Finansinis veiksmas negali remtis unsigned turiniu.
3. Workbench pasirinktos paskirties Event deliveries: fiksuoti event.id,
   šaltinį, livemode, paskirties ID, HTTP kodą, bandymo laiką ir programos
   apdorojimo būseną. Reikalingas pasirašyto tinkamo įvykio 2xx, ne vien GET 404.
4. Pasirašymo klaida / TEST įvykis LIVE režime turi būti atmestas. To tikrinimo
   nesiųsti į dabartinę /data; naudoti tik atskirai leistą naują saugyklą.
5. Pakartotinis to paties event.id pristatymas neturi kartoti finansinio veiksmo.
   Nesusietas demonstracinis įvykis gali gauti 2xx ir būti ignoruotas: tai
   patvirtina transportą, bet ne tikro užsakymo finansinį settlement.
6. Be LIVE mokėjimo galima atskirai įrodyti onboarding/statuso readback ir
   transportą, tačiau pilno LIVE mokėjimo / banko gavimo įrodymo neišgalvoti.
   Šiame etape nesiunčiamas net demonstracinis LIVE įvykis.

## Pirmas tikras nuomotojas – vykdymas tik po atskiro leidimo

Dabartinis LIVE onboarding reikalauja COMMERCIAL_SCT_RUNTIME_ENABLED=true;
negalima jo dabar įjungti vien tam, kad gautume formą. Tai aktyvavimo
priklausomybė: parengti onboarding-only atskyrimą arba suderintą vėlesnį
perjungimą, paliekant checkout finansinius vartus uždarus.

1. Nuomotojas pats registruojasi / prisijungia savo supplier paskyra. Operatorės
   administratoriaus paskyra neatstoja kito nuomotojo tapatybės.
2. Išmokų srityje pasirenka LT ir faktinę individual/company formą, aiškiai
   inicijuoja prijungimą. Serveris POST /api/stripe/connect/create-account
   naudoja sesijos userId/email; ne vartotojo perduotą accountId.
3. Sukuriamas v2 recipient-only Express su stripe_balance.stripe_transfers;
   fees_collector ir losses_collector application, EUR. Nuomotojui papildomų
   Stripe kaštų neatskaityti: A modelis 15/85 prieš jo įstatyminius mokesčius.
4. POST /api/stripe/connect/hosted-onboarding-link grąžina trumpalaikę privačią
   connect.stripe.com nuorodą tik savininkui. Tapatybę, banką ir sąlygas pats
   nuomotojas pildo Stripe; agentas nepriima sąlygų ir nepasirašo.
5. Grįžus į /?view=supplier-payouts&stripe_onboarding=return serverio
   GET /api/stripe/connect/status iš naujo skaito Stripe; grįžimas nėra sėkmė.

### Atskiri priėmimo kriterijai

| Patikra | Reikalingas įrodymas |
|---|---|
| Tapatybė / režimas | Tikras authenticated supplier userId susietas su vienu v2_recipient_sct_live acct_, teisinga platforma, livemode=true, LT, sutampanti entity_type, Express, recipient-only, application kaštai/nuostoliai |
| Pervedimas į Stripe balansą | configuration.recipient.capabilities.stripe_balance.stripe_transfers.status=active; jokio aktualaus trūkstamo reikalavimo / disabled_reason; patvirtinta provider readback, ne URL ar mygtukas |
| Banko išmokų konfigūracija | Atskirai GET v1 /accounts/{id} arba Dashboard: payouts_enabled=true, nėra payout apribojimų / aktualių neįvykdytų reikalavimų, tinkama EUR banko išorinė sąskaita ir grafikas; bankas ne errored / verification_failed. Vien banko pridėjimo ar status=new nevadinti banko nuosavybės patvirtinimu |
| Banko išmoka atlikta | Tik vėliau leidus tikras operacijas: to nuomotojo po_ objektas, suma/valiuta, account kontekstas, status=paid ir atskiras gavimo banke patvirtinimas; dabar nebandyti |
| Programos ribos | status() šiuo metu visada grąžina bankPayoutsReady=false ir payoutsEnabled=false; tai konservatyvi nepatikrintos banko būsenos reikšmė, ne tikro Stripe draudimo įrodymas. registerRecipient taip pat bankPayoutVerified=false |

Banko parengtį reikia atskirai įgyvendinti / fiksuoti; nebandyti apeiti
false tiesiog pakeičiant vėliavą. Nuomotojo charges_enabled nėra būtina
recipient-only SCT mokėjimo priėmimo sąlyga; klientą apmokestina platforma.

## Šaltiniai

- server.js: raw webhook, signavimo paslaptys, režimo patikra ir switch.
- modules/commercial-sct-webhooks.js: tikslūs finansiniai įvykiai ir provider readback.
- modules/sct-supplier-onboarding.js, modules/sct-onboarding-routes.js:
  sesijos savininkas, v2 recipient, hosted link, statuso ir banko ribos.
- https://docs.stripe.com/webhooks (snapshot/thin atskyrimas, Workbench, signing secret).
- https://docs.stripe.com/connect/accounts-v2 (recipient ir v1 readback suderinamumas).
- https://docs.stripe.com/connect/webhooks (platformos ir Connect šaltiniai).
