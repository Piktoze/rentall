# Komercinė SCT vykdyklė: kodas paruoštas, LIVE neįjungtas

Bazė: `staging/v203` nuo `cfcfbb8`. Tikrų Stripe TEST scenarijų įrodymai
`7e330c2` nepakeisti ir nekartoti. Nauji testai naudoja LIVE formos sintetinius
objektus, vietinius SDK pakaitalus ir išjungtą HTTP/HTTPS išėjimą. Jokio LIVE
Stripe finansinio veiksmo, tikro laiško, `/data` atvėrimo ar saugyklos perjungimo.

## Įgyvendinta

- `commercial-sct-client`: tik LIVE rakto tipo klientas, brand patikra,
  20 s timeout, automatiniai SDK pakartojimai išjungti. Kodo importas HTTP neatlieka.
- `commercial-sct-runtime`: atskiras komercinis žurnalas, komandos ir būsenos,
  immutable platformos paskyros / nuomotojo gavėjo / sumų / LIVE / A modelio
  susiejimas; jokių TEST ar istorinių užsakymų migracijų.
- Prieš paleidžiant vykdyklę būtina patikrinti tikslų platformos account ID,
  charges/payouts/details, kortelių galimybę ir neįvykdytus reikalavimus.
  Prieš naują mokėjimą/pervedimą – LIVE nuomotojo gavėjo pervedimų galimybė.
  Nuomotojas privalo turėti serverio išsaugotą autentifikuotą
  `stripe_connections` susiejimą `v2_recipient_sct_live`; administratoriaus
  pateiktas svetimas account ID ar senas merchant ryšys netinka.
- Mokėjimas platformoje; nėra automatinio destination charge, application fee
  ar on_behalf_of perrašymo. Komisinis 15 %, gavėjo dalis 85 %;
  mokėjimo, Connect ir banko išmokų kaštai tenka platformai.
- Pervedimas į gavėjo Stripe balansą tik kai tikrai apmokėta, abi sutartys ir
  perdavimas jau įvykę kanoninėje nuomos eigoje, daiktas grąžintas tinkamas,
  nėra ginčo, sulaikymo, refund ar konfliktuojančios operacijos. Tai ne banko išmoka.
- Visiškas refund tik iki perdavimo; jau pervesto / grąžinto užsakymo ši komanda
  neperinterpretuoja. Dalinės kompensacijos ir pervedimo reversal nėra automatiškai leidžiami.
- SQLite `synchronous=FULL`; komanda su SHA-256 turinio maiša išsaugoma iki
  provider I/O. Vienas booking/kind, vienas stabilus idempotency key ir provider ID.
- Atkūrimas po nežinomo atsakymo pirmiausia ieško tikro vienintelio provider
  objekto ir tikrina sumas, platformą, gavėją, Charge ir PaymentIntent sąsajas.
  Dviprasmiškas ar nepilnas provider sąrašas blokuoja veiksmą.
- Administratoriaus `retry` tik neapibrėžtai komandai iki 23 val. nuo pirmojo
  bandymo: tik tas pats raktas/turinys, pakartotinai patikrinus sulaikymus,
  provider istoriją ir pervedimo lėšų prieinamumą. Naujo rakto nekuria. Po lango
  ar pasikeitus turiniui – tik rankinis suderinimas, ne aklas pakartojimas.
- Darbuotojas neleidžia pirmoms užblokuotoms komandoms marinti vėlesnių.
  Atskirai suranda apmokėtus žinomus PaymentIntent ir atkuria `paid`, net jei
  webhook buvo prarastas. Žurnaluose nėra client_secret.
- Atskiras LIVE webhook apdorojimas po įprastos serverio parašo patikros:
  platformos event, mode ir objektų binding, durable dedup, retry po nesėkmės.
  Ginčo duomenys iš naujo paimami iš provider; uždarytas ginčas savaime nenuima
  apskaitos sulaikymo. Nuomotojo Connect event ar TEST event nelaikomas platformos mokėjimu.
- `paid` ir viso refund pranešimai abiem šalims įrašomi į outbox toje pačioje
  DB transakcijoje kaip galutinė būsena. Atkūrimas nedubliuoja laiškų; siuntimas
  atskirtas nuo finansinės transakcijos.
- Serverio checkout, atšaukimo, naujos rezervacijos ir foninio darbuotojo
  jungtys paruoštos. LIVE administravimo keliai atskiri nuo `/sct-test/`.

## Sąmoningai neįjungta

Railway kintamieji nepakeisti. `COMMERCIAL_SCT_RUNTIME_ENABLED` neįjungtas;
`deferred_supplier_transfer_implemented` bendrame paleidimo vartuose tyčia
nelieka automatiškai patvirtintas pagal vien vietinius testus. Testų sėkmė
nepatvirtina tikros paskyros galimybių, webhook paskirties ar banko išmokų.

Būsimai atskirai peržiūrėtai konfigūracijai reikės pinned platformos ID,
`COMMERCIAL_SCT_POLICY_VERSION=sct-a-15-85-v1`, naujos švarios
`/data/commercial-v1/commercial.sqlite` su atskira uploads saugykla ir markeriu
`{"version":1,"purpose":"fresh-commercial-live","platformAccount":"<verified account>","policy":"sct-a-15-85-v1"}`.
Šis katalogas dabar nekuriamas, esamos `/data` neliečiame. Privataus TEST
katalogo į LIVE nekonvertuoti ir jo sintetinių objektų neperkelti.

Prieš aktyvavimą lieka: operatorės paskyros pateikimas/patikra, tikrų LIVE
nuomotojų SCT recipient onboarding jungtis (esamas merchant Direct Charges
kelias komerciniam režimui užblokuotas), tinkama LIVE platformos / Connect webhook konfigūracija,
nepriklausomos kopijos atkūrimo įrodymas, apskaitos/teisinių sprendimų
patvirtinimas ir konkretus galutinis aktyvavimo pakeitimo patvirtinimas.

## Patikros

`commercial-sct-runtime.test.mjs` ir `commercial-sct-restart.test.mjs`:
24 izoliuotos patikros. Trys atskiri SIGKILL taškai: po mokėjimo, pervedimo ir
refund priėmimo vietiniame provider; kiekvienas atkuriamas dviejuose naujuose
procesuose be antros operacijos. Papildomai: 85 EUR, 100 EUR refund, hold,
TEST/LIVE/paskyros neatitiktis, pasirašyti ir pakartotiniai webhook, ginčas,
prarastas webhook, eilių badavimas, retry langas/turinys ir outbox dedup.

Stripe idempotency semantika:
https://docs.stripe.com/api/idempotent_requests
