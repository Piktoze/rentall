# Vienas perjungimo planas – PERŽIŪRAI, NEAKTYVUOTA

## Aktualus pirmo perjungimo paketas peržiūrai

Vienintelis aktualus PIRMOS FAZĖS variantas:
FIRST-SWITCH-APPROVAL-PACKAGE-2026-11-21.md. Patikrinta 438587392 B
procesui prieinamos /data vietos ir viena replika; abu scheduler išjungti.
Esamo Railway bucket lifecycle NEPALAIKOMAS pagal oficialią dokumentaciją.
Pakete aiškiai išdėstyti privatūs onboarding-only vartai ir allowlist,
nauja DB/uploads vieta, kopijos ir po prastovos taikomas valymas, trumpas
SF/kreditinių peržiūros sąrašas ir rollback į naują izoliuotą TEST.
Joks perjungimas / grafikas / LIVE objektas / tikras dokumentas neaktyvuotas.
Žemiau esanti platesnio aktyvavimo istorija nėra leidimas praleisti
šio pirmo paketo saugos sąlygas ar automatiškai kurti webhook paskirtis.

## Įgyvendinta nuo a8ed296

- CONNECT_ONBOARDING_ONLY_ENABLED atskiria nuomotojo onboarding nuo komercinio
  runtime. Naudojamas atskiras CONNECT_ONBOARDING_SECRET_KEY ir
  CONNECT_PLATFORM_ACCOUNT_ID. Stripe finansinis klientas ir finansinė
  vykdyklė neinstancijuojami. Įjungus tik šį režimą API rašymai už auth,
  keturių autentifikuotų onboarding veiksmų ir webhook ribų grąžina 403;
  mokėjimas / transfer / refund nepasiekiami net per admin ar customer kelią.
  Režimas nesuderinamas su privačiu TEST ar komercinio runtime įjungimu.
  Paleidimui būtina nauja bazė be rental_bookings; senų užsakymų neadoptuoja.
- CONNECT_BANK_READBACK_ENABLED įjungia read-only v1 Account ir viso bankų
  sąrašo patikrą, kai v2 savininko / režimo susiejimas jau patvirtintas.
  Pervedimų į Stripe balansą ir banko išmokų parengtis UI rodoma atskirai.
  Bankui reikia payouts_enabled, švarių aktualių ir laukiančių reikalavimų,
  EUR default banko be klaidos su standard payout galimybe. Vien pridėjimo
  nepakanka: tikrinami visi šie Stripe rodikliai. External banko new gali būti
  normali būsena; nereikalaujama jam netaikomo validated/verified statuso.
  Banko nuosavybės patvirtinimas ir faktinis gavimas dėl to neskelbiami.
- Connect payout snapshot handleris skaito po_ tik su stripeAccount=nuomotojo
  accountId, reikalauja vieno nuosavo v2 SCT susiejimo ir tinkamo režimo.
  Patvarios connect_payout_events/connect_bank_payouts lentelės, event ID
  dedup per proceso atkūrimą, prieštaringų ID atmetimas, provider readback.
  Vienu metu tam pačiam po_ vyksta tik vienas sutikrinimas; klaida leidžia
  Stripe pakartojimą. paid yra Stripe patvirtinta išmoka, ne gavimas banke.
- Platformos ir Connect snapshot paslaptys pririštos prie event.account
  šaltinio. Net tinkamas kitos paskirties parašas nepriimamas. Thin/v2
  pranešimai atmetami; v2 paskirties nekurti. V2 statusą tikrinti per
  autentifikuotą /api/stripe/connect/status su tiesioginiu Stripe readback.
- Naujiems commercial_sct_enrollments būtini atskiri supplier/customer
  tinkamo grąžinimo patvirtinimai; jų negali pateikti trečias asmuo ar body
  userId. UI pateikia aiškų patvirtinimą grąžintam komerciniam užsakymui.
  Fizinio grąžinimo būsena be abiejų patvirtinimų neleidžia pervedimo.
- Komisinio dokumentas ir pervedimo komanda rezervuojami vienoje SQLite
  transakcijoje prieš provider I/O. Pakartojimai nekartoja nei SF, nei transfer.
  15/85, platforma dengia Stripe kaštus. Sulaikymas / ginčas / užstatas ir
  nepatvirtinta apskaita arba serija blokuoja pervedimą; saugos vartai neapeiti.
- RIO-YYYY bendras SF/kreditinių skaitiklis, metinė serija be automatinio
  aktyvavimo, originalūs dokumento snapshot nekeičiami / netrinami per DB
  triggerius. Dalinės susietos kreditinės turi savo stabilų request ID,
  pakartojimai nesukuria antros; suma negali viršyti originalaus komisinio.
  Pilnai atšauktas užsakymas be užbaigtos paslaugos neišrašo komisinio SF.
  Bandomosios numeracijos buvo tik izoliuotose bazėse, tikros serijos fakto
  nepatvirtina. Realios SF/kreditinės šiuo etapu neįjungtos.
- Privatus ne verslininkas → įmonė lieka užblokuotas; apskaitos/VMI klausimo
  šios techninės pataisos neišsprendžia. LT sutarties taisyklė atnaujinta pagal
  operatorės patvirtintą abipusio grąžinimo momentą. Naujo komercinio
  užsakymo konkrečios sutarties snapshot taip pat turi atskirą
  bilateral-commission-v1 versiją ir šias sąlygas; ankstesni snapshot nekeisti.
  Naujam komerciniam užsakymui reikia prisijungusio nuomininko paskyros,
  kad abipusis grąžinimo patvirtinimas nebūtų nepasiekiamas svečiui.

## Nuoseklus aktyvavimo planas (visiems pakeitimams atskiras galutinis leidimas)

1. Prieš perjungimą: fiksuoti dabartinį commit, Railway kintamųjų vardus ir
   ne slaptus režimų parametrus, privačios TEST saugyklos kelią. Esamos /data
   istorijos nekeisti, jos objektų į naują finansinę bazę neperkelti.
2. Leistoje naujoje /data/commercial-v1 saugykloje sukurti naują komercinės
   DB ir atskiros uploads vietą bei patikrintą markerį. Tai būsimas naujas
   katalogas, dabar nekurtas. DB_PATH ir UPLOADS_DIR keisti tik po patikros;
   patvirtinti teises, SQLite WAL / synchronous FULL ir disko persistenciją.
   LIVE Stripe platformos pin acct_1UT4J2LlutaSFdau.
3. Reguliarios kopijos: operatorė savo įrenginyje sugeneruoja privatų/viešą
   raktą; Railway gauna tik viešą. Suplanuoti rašymo pauzę VISIEMS rašytojams,
   SQLite backup API ir uploads vieno rinkinio manifestą, AES-GCM+RSA-OAEP,
   turimą Railway bucket ir naują bundles-v1 prefiksą. Rašymo koordinavimas
   dabar įgyvendintas ir izoliuotai patikrintas: aktyvių HTTP/worker darbų
   drain, uždaras naujų darbų įleidimas, SQLite ir nuotraukų vartai, finally
   atnaujinimas net klaidos atveju. Ne vien quiesced=true. Diegimui patikrinti
   vieną repliką / rašantį procesą ir išjungtą seną scheduler. Grafikas peržiūrai:
   kas 6 val., 28 rinkiniai / 7 d.; nevadinti jau įjungtu. Iš anksto paruošti
   vietinio parsisiuntimo komandą ir atskirą saugų laikymą už Railway ribų.
   Ankstesnis bendros kopijos restore PASS galioja, nekartotas.
4. Pirmiausia įjungti TIK onboarding-only naujoje saugykloje; palikti
   COMMERCIAL_SCT_RUNTIME_ENABLED=false, mokėjimų vartus uždarytus, TEST
   finansinį runtime išjungtą. Atskirą Connect raktą pateikti saugioje Railway
   formoje, ne pokalbyje. CONNECT_BANK_READBACK_ENABLED=true.
5. Leisti pirmam tikram nuomotojui pačiam prisijungti savo supplier paskyra,
   pasirinkti LT/entity, atidaryti savo privačią connect.stripe.com formą ir
   pačiam užpildyti tapatybę/banką bei priimti Stripe sąlygas. Agentas už
   nuomotoją nepasirašo. Statusą patikrinti GET, ne return URL.
6. Atskirai leidus sukurti LIVE Snapshot Connect paskirtį tame pačiame
   https://rentinorbit.com/api/stripe/webhook: payout.created/updated/paid/
   failed/canceled; account.updated ir account.external_account.updated
   tebėra informaciniai (statusas tiesiogiai GET). Atskiras
   STRIPE_CONNECT_WEBHOOK_SECRET, event source Connected accounts.
   Onboarding-only režime platformos finansiniai įvykiai atmetami.
7. Platformos Snapshot paskirtį su a8ed296 plane nurodytais 8 finansiniais
   įvykiais kurti tik suderintame komerciniame perjungime: dabartinis TEST ir
   onboarding-only handleris negali įrodyti LIVE platformos settlement.
   Atskiras STRIPE_WEBHOOK_SECRET. API schema pagal serverio versiją
   2026-08-26.dahlia; v2 thin išjungtas. Workbench tikrinti paskirtį, event.id,
   source/mode, parašą, 2xx ir patvarią processed būseną / dedup; transportas
   nesusietam demonstraciniam įvykiui nėra tikras finansinio settlement testas.
8. RIO-2026 nepanaudojimas jau patvirtintas 2026-11-21, pradžia
   RIO-2026-000001. Faktą saugo RIO-2026-PREPARED-NUMBERING.json, jis
   automatiškai neimportuojamas į DB. Dar būtini atskiras aktyvavimo leidimas ir
   apskaitos peržiūra. Tik tada užpildyti metų commission_series faktą,
   leisti numeravimo aktyvavimą ir COMMISSION_ISSUANCE_ENABLED. Naujo metų
   numerio be patvirtinimo nekurti. Patvirtinti galutinius dokumentų rekvizitus
   ir pateikimo klientui formatą prieš pirmą tikrą dokumentą.
9. Tik po pirmo gavėjo banko konfigūracijos, teisinės/apskaitos ir kopijų
   parengties pateikti galutinį mokėjimų įjungimo pakeitimą operatorės
   patvirtinimui. Šis dokumentas jo nesuteikia. Vėlesnė tikra banko išmoka
   įrodoma atskiru po_ / teisinga paskyra / paid ir gavimu banke, ne tr_ ID.

## Konkretus saugyklos variantas

Naudoti esamos Railway paslaugos turimą volume, bet tik naują atskirai leistą
/data/commercial-v1/ katalogą: DB_PATH=/data/commercial-v1/commercial.sqlite,
UPLOADS_DIR=/data/commercial-v1/uploads. Ankstesnių /data failų neperrašyti ir
istorinių / TEST užsakymų nemigruoti. Prieš būsimą sukūrimą patikrinti naują
markerį, katalogo tuštumą, dabartinio volume laisvą vietą, teises, vieną repliką
ir esamą planą; jei pakankamos vietos nėra, nekurti mokamos alternatyvos be
atskiro leidimo. Šis variantas neperka naujo volume ar paslaugos. Dabar jokie
katalogai /data nekurti ir DB_PATH/UPLOADS_DIR nekeisti.

Kopijų koordinavimo / peržiūros nustatymai ir tikslios operatorės komandos:
COORDINATED-BACKUP-REVIEW-2026-11-21.md. Fizinio 7 d. ištrynimo visam paslaugos
prastovos laikotarpiui S3 lifecycle neįjungtas; taikomas sėkmingų job retention.

## TEST dokumentai nuomotojo paskyroje

Paskyros meniu → Išmokos → TEST dokumentų pavyzdžiai. Dvi autentifikuotos
parsisiuntimo nuorodos: /api/supplier/accounting/test-examples/invoice.pdf ir
/api/supplier/accounting/test-examples/credit.pdf. Tik privatus Stripe TEST
režimas ir supplier/admin. Tai bendri sintetiniai pavyzdžiai, ne kito kliento
privatūs dokumentai. Nauja laikina SQLite, TEST-RIO-2026-000001 komisinis 15 EUR
nuo 100 EUR nuomos; TEST-RIO-2026-000002 dalinė kreditinė 5 EUR, aiškiai susieta
su pirmu dokumentu, likutis 10 EUR. PDF naudoja esamą RentInOrbit logotipą ir
lietuvišką šriftą. Tikros RIO serijos ir esama programos bazė negeneruojant
pavyzdžių nenaudojamos. Dokumentai nepažymi tikro išrašymo ar tikro mokėjimo.

## Grįžimas atgal

Iki pirmo realaus finansinio veiksmo: sustabdyti naujus prisijungimo/link
kūrimo veiksmus ir darbuotojus, išsaugoti naujos DB/uploads kopiją ir
susiejimus; grąžinti ankstesnį patikrintą commit ir TEST DB/uploads/režimą.
LIVE gavėjų ar naujos saugyklos netrinti; LIVE raktai neturi likti TEST
finansiniame kliente. Ankstesnės /data niekada neatkurti ant naujos bazės.

Jei vėliau jau buvo LIVE finansinių veiksmų: paprastas seno disko atkūrimas
NELEIDŽIAMAS. Uždaryti checkout, sustabdyti naujas finansines komandas,
išsaugoti komandų žurnalą ir atlikti provider readback / idempotency
sutikrinimą. Nei nauji komandų raktai, nei istorijos išmetimas nėra rollback.

## Tik operatorės veiksmai / sprendimai

- RIO-2026 nepanaudojimas PATVIRTINTAS; pradžia 000001 paruošta.
  Šio fakto nebeklausti. Vėliau reikės tik atskiro aktyvavimo leidimo. Paslaugos užbaigimo momentas jau patvirtintas,
  jo pakartotinai neklausti.
- Galutinė apskaitos/kreditavimo ir kategorijų saugojimo projekto peržiūra;
  privataus nuomotojo → įmonės VMI išvada ir užsienio paslaugų PVM atskirai.
- Raktą laikyti savo įrenginyje, parinkti kopijų laikymo už Railway vietą ir
  patvirtinti grafiko bei naujos saugyklos perjungimo planą. Privataus rakto
  pokalbyje nepateikti.
- Pirmas nuomotojas pats užpildo oficialią Stripe formą ir priima sąlygas,
  kai šis atskiras etapas bus leidžiamas.
- Esamo Zoho DPA faktinė būsena: accounts.zoho.eu/home → Privacy → Data
  Processing Addendum → esamas prašymas. Rodyti būseną / Sign / Review /
  Download, ne asmeninę nuorodą. Naujo prašymo nekurti.

## Patikrų apimtis

Tik izoliuotos laikinos SQLite bazės ir Stripe SDK pakaitalai, tikri vietiniai
HTTP maršrutai / parašai. Naujas connect-prelaunch.test.mjs; papildytas
commercial-sct-runtime.test.mjs; SIGKILL regresijoms tik lokalūs pakaitalai.
webhook-signed-http-v231.test.js tikrina parašus, šaltinio ir režimo atskyrimą,
thin atmetimą ir dedup. Sėkmingi realūs Stripe TEST mokėjimai ir realus
šifruotos kopijos atkūrimas nekartojami. Nauji realūs Stripe objektai nekuriami.

Oficialūs banko statusų / payout įvykių šaltiniai (tikrinta 2026-11-21):
https://docs.stripe.com/api/external_account_bank_accounts/object
https://docs.stripe.com/connect/manage-connected-account-payouts
Payout įvykiai yra v1 net Accounts v2 gavėjams; papildomas thin endpoint tam nereikalingas.
