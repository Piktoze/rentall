# RentInOrbit – aktualus pilno paleidimo blokatorių registras

## Naujausia LIVE parengtis 2026-11-21 – tik peržiūra

Platformos anketa pateikta ir LIVE paskyra acct_1UT4J2LlutaSFdau patvirtinta:
charges_enabled=true, payouts_enabled=true, details_submitted=true;
aktualių privalomų duomenų / pending_verification nėra, banko sąskaita pridėta.
**Anketos pateikimo blokatorius pašalintas.** Ankstesnis
`evidence/2026-11-21-live-account-followup.json` yra istorija, ne dabartinė būsena.

LIVE gavėjų dar nėra (v1/v2 sąrašai tušti), webhook paskirčių nėra
(v1/v2 sąrašai tušti). Parengta tik peržiūrai:
`LIVE-WEBHOOK-AND-FIRST-SUPPLIER-REVIEW-2026-11-21.md`.
Nekurta paskirtis ar gavėjas, jokios LIVE konfigūracijos / finansinės operacijos.

Likę techniniai LIVE blokatoriai: platformos snapshot webhook sukūrimas ir
pristatymo įrodymas; pirmo tikro v2 recipient savininko onboarding; atskiras
banko payout readback ir patvarus monitoringas (dabartinis Connect switch tik
loguoja, bankPayoutsReady tyčia false); saugus onboarding atskyrimas nuo
komercinės vykdyklės įjungimo arba vėlesnis suderintas perjungimas su uždaru
checkout. V2 thin įvykių gavimo kelias neįgyvendintas; snapshot handleriui jų
nepriskirti. Nuolatinė saugykla / reguliarios kopijos, apskaita, kategorijų
saugojimas, privataus nuomotojo → įmonės mokestiniai dokumentai ir Zoho DPA
lieka kaip ankstesniame registre. Kopijos atkūrimo PASS jau yra ir nekartotas;
Stripe TEST mokėjimai nekartoti.

## Ankstesnė būsena ir patikrų istorija (žemiau)

## Aktualus tęsinys 2026-11-21 (senesni planai toliau – istorija)

**Papildyta tikru Stripe TEST įrodymu:** esamas TEST gavėjas
`acct_1UdAsYLM72k4RDTw`, platforma `acct_1UT4JCLM72MR015z`.
Autentifikuotas statusas ir privati hosted onboarding nuoroda PASS;
svečias ir kitas nuomotojas neprileidžiami; pervedimų galimybė aktyvi.
Jokios naujos Stripe paskyros, sąlygų priėmimo ar finansinės operacijos.
`evidence/2026-11-21-sct-authenticated-onboarding.json`. Grįžimas iš Stripe
atidaro tikrą nuomotojo išmokų darbo sritį (ne vien paslėpto skydelio open klasę).
1280/390 px naršyklės testai PASS, be pakartojimų;
`evidence/2026-11-21-onboarding-return-ui.json`.
Sėkminga schema atpažįsta Stripe v2 aktyvios capability atsakymą be write
parametro requested; finansiniam pasirengimui toliau būtinas active ir
įvykdyti reikalavimai. Vienkartinis onboarding bandymo paleidimas išvalytas.

**Aktualūs likę blokatoriai:**
1. LIVE paskyros duomenų pateikimas ir realūs LIVE gavėjai / webhook įrodymai;
   naujausi GET duomenys `evidence/2026-11-21-live-account-followup.json`.
2. Nuolatinės saugyklos atskirai leistas perjungimas ir reguliaraus naujo
   DB+nuotraukų kopijavimo aktyvavimas su operatorės viešuoju raktu; privatus
   raktas ir parsisiųstos kopijos turi būti už Railway ribų. Izoliuotas bucket
   kopijos atkūrimo bandymas jau PASS, jo nebekartoti be priežasties.
3. Trumpas apskaitos / serijos nepanaudojimo / paslaugos baigimo momento
   patvirtinimas ir kategorijų saugojimo projekto peržiūra.
4. Konkreti VMI / apskaitos išvada privataus ne verslininko → įmonės atvejui;
   parengtas klausimas neišsiųstas, kombinacija neatblokuota. Užsienio paslaugų
   PVM lieka atskiras ankstesnis klausimas; VMI registracija nekeičiama.
5. Zoho esamo DPA užbaigimo įrodymas, naudotojos puslapis / būsenos aprašyti
   ZOHO-DPA-USER-CHECK-2026-11-21.md. Pending nėra savaiminis parašo prašymas.

### Naujausias tęsinys: SCT onboarding ir tikras šifruotos kopijos atkūrimas

- SCT gavėjo onboarding sujungtas su autentifikuotais create/status/hosted/embedded
  ir dashboard keliais. Naudojama serverio sesijos tapatybė, fiksuotas gavėjas /
  platforma / režimas, recipient-only modelis, application kaštai ir patvarus
  kūrimo raktas. Svetimas accountId iš body nesuteikia prieigos. TEST savininko
  senas konfigūracijos pin neperrašomas; komercinis režimas lieka neįjungtas.
- 6 naujos realaus vietinio HTTP onboarding patikros ir 1 šifravimo/atkūrimo
  patikra PASS. Aktyvi pervedimų galimybė neskelbiama banko išmokų patvirtinimu.
- Esamame Railway bucket realiai atliktas šviežios kanoninės DB ir sintetinės
  PNG bendros šifruotos kopijos upload → download → restore. SHA-256 manifestas
  ir SQLite integrity PASS; objektas po bandymo pašalintas tik savo naujame
  prefikse. Įrodymas `evidence/2026-11-21-encrypted-bucket-restore.json`.
  Vienkartinio kopijos bandymo paleidimo kintamasis išvalytas.
- Vietiniam laikymui už Railway paruošti viešojo rakto šifravimo ir atskiro
  privataus rakto parsisiuntimo / atkūrimo įrankiai. Reguliarus kopijavimas ir
  saugyklos perjungimas neįjungti. `OFFLINE-ENCRYPTED-BACKUP-2026-11-21.md`.
- Apskaitos sprendimų trumpas sąrašas, atskirai serijos nepanaudojimas ir
  paslaugos baigimo momentas: `ACCOUNTING-APPROVAL-CHECKLIST-2026-11-21.md`.
- Ankstesnis bendras 10 m. sutarčių/ginčų pasiūlymas pakeistas konkrečiomis
  kategorijomis: minimalus sutarties branduolys, žalos įrodymai, logistika,
  pokalbiai ir tikslinis bylos sulaikymas. Visi terminai dar peržiūrai:
  `RETENTION-BY-CATEGORY-2026-11-21.md`.
- Privataus nuomotojo → įmonės atvejui parengtas konkretus NEIŠSIŲSTAS VMI
  paklausimas apie dokumentus, A/B klasę, išskaičiuojantį asmenį ir 100/15/85.
  Kombinacija neatblokuota, GPM bazė / tarifas nespėjami:
  `VMI-PRIVATE-LESSOR-COMPANY-QUESTION-2026-11-21.md`.
- Zoho naršyklė vėl grąžina originating-context klaidą; vartotojos tikslus
  kelias ir reikalingas esamo prašymo vaizdas: `ZOHO-DPA-USER-CHECK-2026-11-21.md`.
  Naujo prašymo nėra. Pending savaime neįrodo, kad laukiamas vartotojos parašas.

### Naujausias papildymas: komercinė vykdyklė ir kopijų tikslas

Komercinė SCT vykdyklė įgyvendinta ir sujungta su serverio keliais, bet
**neįjungta**. Atskiri LIVE susiejimai, platformos ID patikra, 15/85, grąžinimo /
ginčo vartai, viso refund žurnalas, payload hash, ribotas same-key retry,
pasirašytų įvykių apdorojimas, mokėjimo polling ir atominis outbox. 24 offline
patikros, tarp jų trys SIGKILL atkūrimai; jokio LIVE finansinio veiksmo.
Žr. `COMMERCIAL-SCT-PREPARED-2026-11-21.md` ir
`evidence/2026-11-21-commercial-sct-offline.json`.

Esamas `rentinorbit-staging-backups` bucket ir BACKUP_S3 kintamųjų vardai rasti.
Tai atskira saugykla nuo programos disko, bet ta pati Railway paskyra/tiekėjas.
Nepriklausomam tiekėjui siūlomas Backblaze B2 (neužsakytas); kainos ir aiškūs
srauto pavyzdžiai `INDEPENDENT-BACKUP-OPTIONS-2026-11-21.md`.
Kopijos nepradėtos, `/data` nepasiekta ir neperjungta.

Gmail atlikta paieška visur, įskaitant spam/trash: rastas tik 2026-11-17
siųstas esamas DPA laiškas, atsakymo šiame gautame susirašinėjime nėra;
Reply-To – info@rentinorbit.com. Zoho UI ir paštas neprieinami dėl vietinės
naršyklės originating-context klaidos, valdomoje naršyklėje sesijų nėra.
Dabartinė Zoho DPA būsena todėl **nepatvirtinta**, ne dar kartą spėjama Pending.
Naujas prašymas ar pakartotinis laiškas nesiųstas.

Papildomai iš naujos CI nesėkmės pašalintas konkretus laiškų defektas:
serverio šablonams dabar apibrėžtas patikimas PUBLIC_BASE_URL. Izoliuotas HTTP
testas tikrina, kad atšaukimo laiškas tikrai įrašomas vieną kartą ir turi
konfigūruotą svetainės origin. Užsakymų sąraše pridėta pasenusių atsakymų
apsauga ir saugus numatytasis filtras; dviejų paskyrų testas laukia tikro
patvirtinimo POST atsakymo prieš skaitydamas nuomininko būseną.

Apskaitos/saugojimo grafikas lieka PROPOSED, NOT APPROVED. Užklausų 12 mėn.
jau patvirtinta; apskaitos dokumentų >=10 metų – teisės aktų minimumas;
likusiems terminams būtina operatorės peržiūra.

**Papildyta operatorės patikslinimu:** operatorė Ieva Piktožė, IV pažyma
751612, veiklos kodas 775200 (EVRK 2.1 / 77.52.00), šiuo metu ne PVM mokėtoja.
Šių duomenų nebeklausti. Tarpininkavimo klasifikavimas patikrintas oficialiai;
atskirai atviri užsienio paslaugų PVM vertinimas, apskaitos tvarka ir, jei
operatorė teiks nuosavų daiktų nuomos paslaugą, tos papildomos veiklos kodas.
Žr. `EVRK-AND-FOREIGN-VAT-2026-11-21.md`.

Techninis papildymas: eilės laiškui prieš siuntimą išsaugomas Resend
idempotency raktas ir turinio maiša. Perkrovimas nesukuria naujo rakto,
pasikeitęs turinys ar >23 val. neapibrėžtumas stabdo automatinį pakartojimą.
Seni neapibrėžti laiškai be anksčiau išsaugoto rakto taip pat neperleidžiami
automatiškai. Naujas tikras laiškų ar finansinis bandymas dėl to nevykdomas.

Sėkmingi tikri Stripe TEST A/B iš `7e330c2` nebekartojami. Modelis yra
**Separate Charges and Transfers**, ne SEPA Credit Transfer. 85 € pervedimas
į Stripe balansą nėra banko išmoka.

| Blokas | Naujas faktas / pašalinta | Kas lieka |
|---|---|---|
| B1 finansai | Tikras TEST mokėjimas, 85 % transfer po grąžinimo, visas refund ir pasirašyti webhookai PASS, `evidence/2026-11-20-sct-real-test.json` | Banko išmokos ir LIVE atskiras etapas; patikrintų TEST objektų nekeisti |
| B2 sąsaja | Dvi nepriklausomos naršyklės sesijos, sutartys, vienkartinis kodas ir grąžinimas PASS 1280/390 px. Atskiras naujos rezervacijos → tiekėjo patvirtinimo → mokėjimo CTA → neapmokėto atšaukimo UI kelias PASS tais pačiais dydžiais. Pataisytas paslėptas užsakymo ekranas atidarant el. laiško nuorodą iki sesijos įkėlimo | CI naudoja izoliuotą serverį; apmokėto UI kelio pradinis `paid` yra aiškus sintetinis precondition. Tai nėra naujas Stripe UI mokėjimo ar autentifikuoto rentinorbit.com E2E įrodymas |
| B3 pranešimai | Visi penki kategorijų laiškai Resend `delivered` ir faktiškai Gmail INBOX (ne spam). Sutvarkyta grąžinimo laiškų eilė abiem šalims; išsaugomas Resend ID. `evidence/2026-11-20-notification-delivery.json` | Šablonų pristatymo bandymas nesukuria tikros nuomos; pranešimų teisinės/apskaitos kategorijos laikomos atskirai |
| B4 dokumentai ir SF | Pilnos LT platformos papildymai: šalių vaidmenys, A modelis, ginčai, atšaukimai, dokumentų išrašytojai, privatumas ir tikra laikina saugykla. Operatorės gauti rekvizitai naudojami iš saugios konfigūracijos. Komisinio ir visos nuomos dokumentų išrašytojai atskirti patikimais snapshot; SF lieka užblokuotos | Užsienio paslaugų PVM ir apskaitos sprendimai, likusių kategorijų saugojimas, Zoho DPA įrodymas, galutinis LT dokumentų patvirtinimas ir atitinkamas kitų kalbų suderinimas. Vienas sąrašas `OPERATOR-DECISIONS-2026-11-21.md` |
| LIVE ir nuolatinė saugykla | Tik skaitymo LIVE patikra ir tik laikinuose kataloguose sėkminga DB+failų repeticija. Konkretus planas `PERSISTENT-LAUNCH-PLAN-2026-11-20.md` | Pasiekiama LIVE paskyra turi neaktyvius mokėjimus/išmokas, nėra banko ir V1 webhookų/nuomotojų. Ryšys su TEST sandbox nepatvirtintas. SCT vykdyklė lieka tik TEST; atskiras nuolatinis privatus TEST režimas įgyvendintas ir izoliuotai patikrintas, bet neįjungtas. Komercinio LIVE vykdymo vartas `deferred_supplier_transfer_implemented` lieka false. Esamos `/data` neliesti |

### Naujausias techninis papildymas: 2026-11-21

- Nuolatinis **privatus TEST** SCT režimas įgyvendintas atskira saugyklos
  parinktimi, su naujo katalogo markeriu ir senų mokėjimų atmetimu. Dabartinė
  Railway konfigūracija į jį NEPERJUNGTA; `/data` nepaliesta.
- Diskinio žurnalo atkūrimas po trijų SIGKILL taškų (payment/transfer/refund)
  ir dviejų atskirų atkūrimo procesų: PASS su vietiniu teikėjo pakaitalu.
  Tikri Stripe TEST A/B iš 7e330c2 nekartoti. Neaiškus rezultatas be vienintelio
  patikimo provider objekto toliau sustabdomas rankiniam suderinimui, ne aklam retry.
- Pataisytas vykdyklės eilės badavimas: pirmi dešimt užblokuotų komandų
  nebestabdo vėlesnių. Darbuotojo rezultatų žurnale nelieka PaymentIntent
  `clientSecret`; tikrinamas rezultato laukų leidžiamasis sąrašas.
- Tikras izoliuotas HTTP serveris po SIGKILL išlaiko paskyrą/sesiją/failą;
  privačiai prieigai privalomas naujas OTP. Prieigos, admin, rolės, CSRF ir
  užklausų dažnio apsaugos PASS. 120 paieškos užklausų / 12 lygiagrečių:
  be 5xx. `evidence/2026-11-21-targeted-security-load.json`.
  Tai tikslinė vietinė patikra, ne nepriklausomas pentestas ar Railway talpos garantija.
- LIVE skaitymo įrodymai atnaujinti: `evidence/2026-11-21-live-readiness.json`.
  Mokėjimai/išmokos išjungti, duomenys nepateikti, banko nėra. V1 webhookų ir
  Connect sąrašai tušti; V2 paskyrų ar Workbench nebuvimas tuo neįrodytas.
- Konkretūs apskaitos/saugojimo pasiūlymai parengti
  `ACCOUNTING-RETENTION-PROPOSAL-2026-11-21.md`, statusas PROPOSED.

| Likęs blokatorius | Konkretus užbaigimas | Kas veikia dabar |
|---|---|---|
| Komercinė nuolatinė mokėjimų vykdyklė | Adapteris ir vykdymo serverio jungtys paruošti; lieka tikrų LIVE gavėjų onboarding užbaigimas ir tikros paskyros / webhook įrodymai ir atskirai patvirtintas aktyvavimas | Nuolatinis TEST ir komercinio adapterio offline patikros PASS; LIVE vartas nepakeistas |
| Nuolatinės saugyklos perjungimas ir avarinė kopija | Atskirai leistas naujas katalogas; vietos/sąnaudų patikra; bendras DB+failų manifestas ir nepriklausomas kopijos tikslas; tikras Railway perkūrimo bandymas | Kodas ir konkretus perjungimo/rollback planas parengti; perjungimas dabar draudžiamas |
| LIVE Stripe aktyvavimas / banko išmoka | Operatorė užpildo oficialią Stripe formą; paskui tikrinami Connect/webhook ir išmokos atskiru leidimu | Šviežia GET patikra; jokio LIVE finansinio veiksmo |
| Apskaita ir dokumentų patvirtinimas | Peržiūrėti konkretų RIO numeravimo/kreditavimo/saugojimo projektą; užbaigti privačios nuomos → įmonės tvarką arba palikti derinį blokuotą; LT ir kitų kalbų galutinis suderinimas | Rekvizitai ir A modelis įtraukti; tikros SF neišrašomos |
| Tiekėjų sutartys / užsienio paslaugų PVM | Zoho esamo DPA užbaigimo įrodymas; atskiras faktinių užsienio paslaugų sąskaitų mokestinis vertinimas | VMI registracija nekeičiama; techniniai darbai nuo to nestabdomi |

**Pilnos platformos NO-GO lieka.** Techninių ir teisinių saugos vartų neišjungti.
DNS, Zoho/Resend įrašai, istoriniai užsakymai ir LIVE finansinės operacijos nekeičiami.


---

## Istorinės instrukcijos ir ankstesni rezultatai

Šios tolesnės instrukcijos nėra dabartinės būsenos įrodymas. Užbaigtų bandymų nekartoti be konkrečios priežasties.

**Parengta:** 2026-11-09. **Statusas:** vykdymo instrukcija, NE įvykdytų E2E testų ataskaita.
**Tikslas:** trečiadienį vienu valdomu Work seansu atlikti likusius realius įrodymus ir priimti tik įrodymais pagrįstą GO/NO-GO. Nebeplėsti kosmetinių darbų.

## 2026-11-20 – privalomas SCT scenarijus (viršesnis už istorines Direct Charges instrukcijas)

**Dabartinis preflight:** `staging/v203` HEAD `717b424f9a2fdbde88b78264ca2a61b534ac421f`; Railway staging deployment `fab829a3-2edd-434c-988f-f856ddeffce1` SUCCESS. GitHub prieinamas commit workflow sąrašas tik PR tipo: Chromium 14/14 **NOT VERIFIED**. Tai nėra naujų testų PASS. Šis skyrius pakeičia žemiau esančias Direct Charges vykdymo instrukcijas; jos paliktos tik istorinei atsekamybei.

**B1 – Stripe Connect Separate Charges and Transfers (SCT), tik Work / autorizuotas TEST:**
1. Tiksliai identifikuoti naują sintetinę A rezervaciją, savininką, susietą TEST Connect paskyrą, tiekėjo patvirtinimą, vienos dienos/kiekio/datyvų kainodaros snapshot ir galutinę 100,00 EUR sumą. Iki tiekėjo patvirtinimo mokėjimas turi būti blokuotas. Bet koks neatitikimas = STOP.
2. Patikrinti, kad PaymentIntent kuriamas **platformos TEST paskyroje**, o ne kaip Direct Charge tiekėjo paskyroje; `livemode=false`, `amount=10000` ct, `currency=eur`, rezervacijos metadata, stabilus idempotency key. Komisija 15,00 EUR ir tiekėjui skirta 85,00 EUR tik jei konkretaus užsakymo užfiksuotas planas patvirtina 15 %; nepasikliauti vien bendru platformos tarifu.
3. Tik po autorizuoto TEST apmokėjimo patikrinti pasirašyto webhook įvykį, įvykio ID, booking `paid`, pakartotinio webhook/replay atmetimą ir antro mokėjimo neatsiradimą. Tikras TEST PaymentIntent/Charge ID būtinas; vien izoliuoti testai nėra gyvos operacijos įrodymas.
4. A atšaukimas iki perdavimo ir TEST refundas tik pagal faktinę užsakymo politiką; sutikrinti Refund ID, sumą, būseną, idempotentiškumą ir neįvykusį ar tinkamai atšauktą tiekėjo transfer. Jei B cikle atliekamas transfer, patikrinti būtent tam užsakymui priskirtą 85 EUR (ar snapshot atitinkančią sumą), gavėją, transfer ID ir grąžinimo/atšaukimo apsaugas. Jokio LIVE, realių lėšų ar ankstesnių svetimų objektų keitimo.
5. **B1 PASS** tik su faktiniais Stripe TEST objektų ID, teisinga platformos ir tiekėjo sąsaja, webhook, mokėjimo ir refund/transfer įrodymais. B2 lieka atskiras dviejų paskyrų, dviejų sutarčių, vienkartinio perdavimo kodo ir grąžinimo be antro kodo scenarijus.

**B3–B5:** izoliuotas S3 atkūrimas tik laikinoje DB, HTTPS/readiness ir pranešimų pristatymas; teisinių tekstų patvirtinimai ir operatoriaus rekvizitai tik vartotojos sprendimu; GO tik kai B1–B4 turi įrodymus. Viešas mokamas MVP = **NO-GO**. Railway 27/27 niekada nelaikyti Chromium 14/14 įrodymu.

## 2026-11-13 00:38 LT – naujausias read-only preflight (viršesnis už istorinius įrašus)

- GitHub `staging/v203` HEAD: `5706bb6af92668eec6bd43755418b14612bb6117` (branch API); šio vykdymo metu naujų commit prieš šį dokumento atnaujinimą nebuvo.
- Railway `nurturing-strength / staging`: deployment `ebb2cc02-397f-4881-a195-33fe7a617c2d` = SUCCESS, commit `5706bb6`, 1/1 replika online, 0 warning/critical, 0 nesėkmingų diegimų per 8 val., 0 pendingWork. Tai **nėra** Chromium ar Stripe TEST įrodymas.
- Railway release gate **27/27 PASS** ankstesniame šio commit build žurnale, užfiksuota [issue #3](https://github.com/Piktoze/rentall/issues/3#issuecomment-6826703688). Šiame vykdyme testai iš naujo nepaleisti.
- Chromium: tiesiogiai patikrintas istorinis [run 42686094634](https://github.com/Piktoze/rentall/actions/runs/42686094634), `head_sha=a49c2893`, `conclusion=failure` (13/14 pagal ankstesnę testo suvestinę). Visų naujesnių `push` vykdymų sąrašo per prieinamą GitHub fetch API gauti nepavyko (workflow runs collection endpoint neleidžiamas). **Dabartinio SHA Chromium 14/14 = NOT VERIFIED, ne FAIL.** Tikrinti pilną [Actions workflow](https://github.com/Piktoze/rentall/actions/workflows/isolated-browser-e2e.yml) sąrašą ir konkretų run/SHA/artefaktą; nepainioti su Railway.
- [Issue #3](https://github.com/Piktoze/rentall/issues/3) ir [issue #2](https://github.com/Piktoze/rentall/issues/2) tebėra atviri. B1 gyvas €100 TEST Direct Charge / €15 fee / signed webhook / refund; B2 dviejų paskyrų naršyklinis ciklas; B3 galutinis restore ir operacinis preflight; B4 teisinis patvirtinimas; B5 GO sprendimas – **neužbaigti**.
- **Work / vartotojos veiksmas:** autentifikuotas dviejų paskyrų UI, Stripe TEST mokėjimas/refundas, galutiniai juridiniai sprendimai. Be atskiro leidimo nieko iš šių veiksmų nevykdyti. Viešas mokamas MVP: **NO-GO**.
- Šis įrašas tik dokumentacinis: nėra naujo Chromium PASS, Stripe operacijos, migracijos ar staging diegimo įrodymas. Toliau esantys istoriniai commit/deploy ID nekeičia šios būsenos.

## 2026-11-11 – patikrinta būsena šiame tęsinyje (naujausia, viršesnė už 2026-11-10 duomenis)

- **GitHub**: tik `Piktoze/rentall` / `staging/v203`; naujausias Railway matytas commit `7c11105afe1e1947943ed7a48a2fc1f512c683e9`, keitęs tik šį Work preflight dokumentą. Šiame etape **jokių naujų kodo pakeitimų nepatvirtinta**.
- **Railway staging**: deployment `81996cca-cc84-45b4-a2a1-b42f87338932` = **SUCCESS** pagal `list_deployments`. Tai nereiškia naujos Stripe operacijos, naršyklinio E2E ar naujo release gate paleidimo.
- **Chromium**: paskutinis turimas konkretus veiksmo įrodymas yra GitHub Actions [42686094634](https://github.com/Piktoze/rentall/actions/runs/42686094634), **13/14 PASS**; žinoma vėlesnė testo pataisa savaime nėra 14/14 PASS. Pilnas naujausių `staging/v203` Actions run sąrašas per šios sesijos prieinamus read-only įrankius nebuvo gautas. Šis faktas reiškia **nepatvirtinta**, o ne kad naujesnių vykdymų tikrai nėra.
- **B1**: patvirtinti atskiri sintetiniai `payment-ops-security.test.js`, `rental-http-e2e-v210.test.js`, `expiration.test.js` regresiniai testai ir ankstesnis 27/27 release gate. Tačiau **tikras Stripe TEST €100 Direct Charge, €15 application fee, Connect supplier account, signed webhook, pilnas refund bei pakartotiniai įvykiai nepatvirtinti**.
- **B2**: izoliuoti serverio HTTP scenarijai ≠ reali dviejų autentifikuotų naudotojų naršyklės nuomos eiga. Įrodyti reikia listing 2–5 images → reservation → owner approval → customer payment → two separate signatures → one-time pickup PIN → supplier return confirmation without second PIN → dispute branch.
- **B3**: ankstesni staging startup ir izoliuoto DB atkūrimo PASS nėra lygiaverčiai patikrintam pilnam recovery pratimui su atsarginių kopijų grafikais ir offsite saugojimu.
- **B4**: operatoriaus teisiniai rekvizitai pildomi tik prieš viešą paleidimą pagal naudotojos sprendimą. Teisinių tekstų projektai dar nėra galutinis juridinis patvirtinimas.
- **B5**: viešas mokamas paleidimas = **NO-GO**. B1/B2/B3/B4 galutinės faktinės įrodymų spragos lieka.
- **Darbo taisyklė**: be Work galima tęsti tik izoliuotus testus, saugumo ir dokumentacijos pataisas. Nepradėti realių Stripe operacijų, LIVE, production, `main`, `/data` pakeitimų, mokamų paslaugų ar teisinio sutikimo. Neskelbti 14/14 ar E2E PASS be naujo konkretaus run URL, SHA, tests summary ir artefakto.

## 2026-11-10 18:38 LT – naujausias patikrintas preflight (viršesnis už žemiau esančius istorinius commit ID)
- Railway **staging** environment ID `ca5aa000-83a9-40b9-b9b6-74b3602f3dde`; paskutinis sėkmingas deployment `2a0f9a95-4d7a-4f5b-9ab9-eed6115d18a5`, commit `2f28acacf07d7ffab655e24e57b43151b4278129` (2026-11-10 16:04 LT). Online 1/1, 0 aktyvių warning/critical, 3 ankstesni FAILED per 8 val.; pendingWork 0. Tai **nėra** naujo Chromium ar Stripe TEST E2E įrodymas.
- GitHub Actions senas run [42686094634](https://github.com/Piktoze/rentall/actions/runs/42686094634) tebėra **FAIL** naršykliniame žingsnyje (13/14); `fetch_commit_workflow_runs` pagal `2f28acac` grąžino tuščią PR-triggered rezultatą, bet šis API **neapima visų push/dispatch vykdymų**, todėl negalima iš jo daryti išvados, kad naujesnio Chromium vykdymo nėra. Work turi atverti [visus workflow vykdymus](https://github.com/Piktoze/rentall/actions/workflows/isolated-browser-e2e.yml) ir tikrinti paskutinį `staging/v203` run, jo commit, job, testų skaičių ir artefaktą; jei nėra aktualaus PASS, izoliuotą workflow paleisti tik saugiai, nekeičiant production ir nenaudojant mokamų kreditų.
- Izoliuoto workflow `on.push.paths` filtrai reiškia, kad ne kiekvienas commit automatiškai paleidžia Chromium. Railway release gate **27/27** laikyti atskiru nuo Chromium **14/14**.
- Tikras €100 Stripe TEST Direct Charge / webhook / refundas ir dviejų prisijungusių paskyrų UI eiga lieka **NOT RUN / BLOCKED**, B1–B5 neuždaryti. Neatlikti mokėjimų ar juridinių sutikimų be atskiro leidimo.
- Šiame protokole žemiau pateikti ankstesni commit/deploy ID yra **istoriniai**; prieš bet kokį veiksmą vėl perskaityti faktinę šaką, staging deployment ir issue #3.

## 0. Nekeičiamos ribos
- GitHub **tik** `Piktoze/rentall`, šaka `staging/v203`; Railway **tik** `nurturing-strength / staging`, URL `https://rentall-staging.up.railway.app`.
- Stripe **tik TEST/sandbox, livemode=false**. Jokio LIVE, production, `main`, `/data` pakeitimo ir realių klientų duomenų. Naujos mokamos paslaugos ir papildomų kreditų biudžetas 0 €.
- Nespausti teisinio sutikimo, paskyros atnaujinimo, neinicijuoti neaiškaus mokėjimo/refundo be reikalingo vartotojos leidimo. TEST sandoriui naudoti tik Stripe oficialią testinę kortelę, jokios tikros kortelės.
- Nevykdyti grąžinimo nepatikrinus **tikslaus** PaymentIntent, rezervacijos ir tiekėjo sąsajos; neatšaukinėti svetimų/ankstesnių €100 Stripe objektų.
- Testinės rezervacijos turi būti aiškiai pažymėtos ir atskirtos nuo kitų. Jei naudotoja turi prisijungti, leisti prisijungti pačiai; nereikalauti slaptažodžio pokalbyje.
- Pradėti nuo dabartinės GitHub/Railway būsenos, neperdiegti automatiškai, jei viskas veikia. Neuždaryti nė vieno B bloko vien statinių testų pagrindu.

## 1. Žinomi faktai ir nuorodos
- Naujausias patikrintas commit `111fdfb5beb85cc40677ccb02281edc68659374f` (`staging/v203`), Railway deployment `847b6f39-cc71-4287-b7af-c00d35af79b0` – **SUCCESS**; release gate **27/27 PASS**. **Neprilyginti tikram Stripe TEST mokėjimui ar visai nuomai.**
- Naujausias **faktiškai peržiūrėtas** Chromium GH Actions run `42686094634` (commit `a49c2893`) – **13/14 PASS**, vienas testas nesėkmingas dėl paslėpto svečio `#myBookingsBtn`. Pataisa `111fdfb5` įdiegta: svečio meniu turi likti paslėptas, naujai užregistruotas sintetinis `customer` naudotojas gali atidaryti užsakymų skiltį. **Šio naujo commit Chromium 14/14 rezultatas šio dokumento atnaujinimo metu nepatvirtintas.**
- GH Actions izoliuotas Chromium vykdomas po `push` į `staging/v203`; Railway `checkSuites=false`, todėl Railway `SUCCESS` nėra GH Actions `SUCCESS`. Chromium rezultato negalima spręsti vien iš to, kad Gmail negavo nesėkmės laiško. Peržiūrėti GH Actions puslapį: https://github.com/Piktoze/rentall/actions/workflows/isolated-browser-e2e.yml ; paleidimo ataskaitoje rasti `14 passed`, final `success` ir `isolated-browser-e2e-report` artefaktą.
- GH Actions run `42682344603` ankstesnis webhook 500 (`isEmail is not defined`) ištaisytas commit `15e3763`, po to izoliuotas pasirašyto webhook HTTP testas patvirtintas PASS. Tai dar **ne** realus `livemode=false` Stripe mokėjimas ir refundas.
- **B3 išorinis HTTPS jau patvirtintas:** Railway proxy HTTP žurnalai `2026-11-09T19:58:37Z` registravo `200` visiems penkiems **viešiems staging** GET maršrutams: `/healthz`, `/api/readiness`, `/api/ops/status`, `/api/integrations/capabilities`, `/api/listings`. Tai reali momentinė išorinio pasiekiamumo patikra; nepareiškimas apie visos svetainės funkcionalumą. 2026-11-11 pakanka pakartoti trumpą smoke, jei aplinka nepasikeitė, ir sutelkti laiką į naujų A/B rezervacijų laiškus.
- B3: 2026-11-08 Gmail `INBOX` faktiškai gauti RentInOrbit pranešimai `Booking confirmed — complete payment`, `Payment received`, `Booking cancelled`; tai **istorinio pristatymo** įrodymas, o ne 2026-11-11 A/B laiškų patvirtinimas.
- Stripe **TEST sandbox platformos kontekstas** `acct_1UT4JCLM72MR015z`; prijungtas TEST tiekėjas `acct_1UYJrGLM72xqOs4D`. Paskutinį kartą `charges_enabled=true`, `payouts_enabled=true`, `card_payments=active`, `transfers=active`, `currently_due=[]`. Tai **nepatvirtina** susiejimo su konkrečiu staging tiekėju.
- Ankstesnis tikrinimo kandidatas `RB-1793990438974-nfe2k6`; jo tinkamumą ir autorystę būtina patikrinti. Platformos PaymentIntent paieška pagal bookingId anksčiau grąžino 0; **Direct Charge** gali būti matomas tik prijungtos paskyros kontekste.
- Ankstesnis nesusietas €100 PaymentIntent su 3 € application fee **NETINKAMAS** 15 € testui; jo neliesti.
- B1 read-only diagnostika (su teisėta **tiekėjo** staging sesija): `GET /api/stripe/connect/booking-binding/:bookingId`. Tikrinami `supplierOwnsListing`, `hasOwnerStripeConnection`, `ownerDirectChargeReady`, `loggedInStripeConnectionMatchesOwner`, `ownerStripeAccountLast4`. Jei grąžina 404/403 arba neatitikimą – **STOP**, netaisyk mokėjimo aklai.
- B1 mokėjimo kūrimo maršrutas `POST /api/payments/create-intent`; tik po supplier `confirmed`, serveris skaičiuoja kainą ir platform fee; Stripe Direct Charge kuriamas susietai paskyrai. `rentalPreauthEnabled=false` (sąmoningai išjungtas legacy hold režimas).
- B3 ankstesni Railway runtime žurnalai: S3 `database_backup_restore_check ok=true`, `integrity=ok`, 55 lentelės, migracija 184, `restoreVerified=true`; el. laiškų **pristatymas** nepatvirtintas.
- B4 operatorė turi individualią veiklą. **Jos EVRK, IV pažymos duomenis, rekvizitus ir galutinį publikavimą pagal vartotojos sprendimą atidėti iki pat galutinės stadijos**. Neskelbti išgalvotų rekvizitų.
- Kritinių blokų registras: https://github.com/Piktoze/rentall/issues/3 . Nekritiniai darbai: https://github.com/Piktoze/rentall/issues/2 .

## 2. Prieš naršyklinius veiksmus – Work preflight
1. Patikrink, kad atidarytas **staging**, o ne production; užfiksuok URL ir dabartinį commit/deploy.
   **Pirmiausia patikrink paskutinio CI commit `111fdfb5` GitHub Actions rezultatą:** jei `14/14 PASS`, užfiksuok run URL ir viso job būseną; jei FAIL, perskaityk konkretaus testo trace ir tik tada taisyk. Nieko nepriskirk PASS pagal Railway rezultatą.
2. Prieš Work naršyklinę patikrą peržiūrėk GitHub Actions paskutinio `staging/v203` bėgimo žingsnį **`Probe public staging HTTPS endpoints (read-only evidence)`**: kiekvienam maršrutui žurnaluose surask `STAGING_HTTP`. Šis žingsnis įtrauktas commit `493a6dfa` ir yra **tik informacinis** – `200` patvirtina atskirą GET bandymą tuo momentu, o `401/403` gali reikšti saugiai apsaugotą maršrutą; `UNAVAILABLE` nėra nuosprendis be pakartotinio bandymo. Neišgalvok atsakymo turinio ir neprilygink jo gyvo Work sesijos E2E.
3. Iš Work komandų aplinkos, jei yra prieiga ir priklausomybės, paleisk tik skaitymo veiksmą `node release/smoke-production.mjs https://rentall-staging.up.railway.app` (tai tik HTTP smoke, jokio diegimo ir mokėjimo). Atskirai patikrink `GET /healthz`, `GET /api/readiness`, `GET /api/ops/status`, `GET /api/integrations/capabilities` ir atsakymo kodus; nepublikuok sesijos tokenų, Stripe paslapčių ar klientų PII. `/api/launch-readiness` gali grąžinti 503, kai galutiniai teisiniai rekvizitai nepateikti – dokumentuok tikslią priežastį, ne apeik.
3. Staging tiekėjo paskyroje patikrink Connect statusą. Prieš bet kokį mokėjimą B1 diagnostikoje patvirtink, kad tiekėjas yra rezervacijos skelbimo savininkas ir jo susietos Stripe paskyros paskutiniai keturi ID simboliai sutampa su **saugiai** patikrintu Stripe TEST kontekstu.
4. Pasirink vieną testinį €100 skelbimą (`V203 Launch Audit 100 EUR Item`, jei vis dar egzistuoja ir priklauso teisingam tiekėjui). Rinkis **atsiėmimą 0 €**, jokių +40 € pristatymo, papildomų užstatų ar kitų prekių; jei tai negalima, užfiksuok kainą ir sustok prieš mokėjimą.
5. Rask dvi **atskiras** paskyras: tiekėjo (skelbimo savininko) ir nuomininko. Jų sesijas atskirk skirtingais profilių / inkognito kontekstais. Nuomininko paskyroje neturi būti tiekėjo valdymo.

## 3. B1 – realus Stripe TEST €100 ir refundas (REZERVACIJA A)
**A paskirtis – finansinis ciklas: iki perdavimo apmokėti ir atšaukti, kad būtų galima patikrinti refundą.**
1. Nuomininkas sukuria naują aiškiai pažymėtą A rezervaciją (tikslas **100 € iš viso**, būsena `pending` / `unpaid`). Rinkis **vieną dieną**: nuomos pradžia bent po 72 valandų, pabaiga kitą kalendorinę dieną, kiekis 1, **atsiėmimas 0 €**. €100/day skelbimo 7 dienų numatytasis kalendoriaus intervalas **nėra €100 rezervacija**. Būtinai patikrink UI galutinę sumą ir serverio rezervacijos `orderValue`: abu turi būti **lygiai €100**, kitaip **STOP, neatlikti Stripe mokėjimo**. Patikrink konkretaus skelbimo atšaukimo politiką ir realią nuomos pradžią – išankstinė data savaime negarantuoja 100 % grąžinimo.
2. Dar prieš tiekėjo patvirtinimą bandyti pradėti mokėjimą **tik per numatytą UI**: jis turi būti neleidžiamas, o Stripe PaymentIntent neturi būti sukurtas. Jei UI siūlo neleistiną kelią – **STOP**.
3. Tiekėjas patvirtina **tą pačią A rezervaciją**. Tikėtina `confirmed` / `unpaid`.
4. Prieš inicijuojant Stripe **dar kartą** palygink A booking `orderValue=100.00`, `quantity=1`, faktines nuomos datas, 0 € atsiėmimą, ir tik tada nuomininkas pradeda mokėjimą UI; patikrink, kad rodoma tiksliai **100,00 €**, o laukiamas platformos mokestis **15,00 €** TIK JEIGU realus tiekėjo planas / kainodaros snapshot patvirtina 15 % (kitu atveju dokumentuok neatitikimą ir nestumk toliau aklai).
5. Stripe TEST mokėjimas per oficialią testinę kortelę; užfiksuok **PaymentIntent ID**, `livemode=false`, EUR 10000 ct, prijungtos tiekėjo paskyros kontekstą, `application_fee_amount=1500` ct jei 15 % planas, `metadata.bookingId=A`, `purpose=rental_payment`.
6. Patikrink Stripe pasirašytą webhook per tikrą webhook gavimo įrodymą ir staging booking būseną `paid`; jei buvo sėkmingas Stripe PI, bet booking tebėra unpaid, **NO-GO**.
7. Pakartotinai atverk užsakymą/pabandyk mokėjimo kelią nekurdamas naujos transakcijos: įsitikink, kad nėra antro nuskaičiavimo / PI.
8. **Dar iki fizinio perdavimo** atšauk A per autorizuotą nuomininko/sistemos UI, laikantis rodomos atšaukimo politikos. Jei tikėtinas refundas skiriasi nuo 100 €, nevadink dalinio refundo gedimu: dokumentuok politiką ir atlik pilno grąžinimo scenarijų tik su aiškiai leistinomis sąlygomis.
9. Patikrink tikrą Stripe TEST Refund ID, būseną, sumą, sąsają su A PaymentIntent, booking `cancelled/refunded` ir idempotentiškumą (pakartotinis mygtuko paspaudimas negali sukurti antro refundo).
10. B1 PASS tik jei yra **visi** A mokėjimo, webhook, būsenos, refundo ir saugiklių įrodymai. Jei Stripe TEST apmokėjimas sėkmingas, bet refundas stringa – B1 lieka atviras, net jei HTTP testai PASS.

## 4. B2 – visas dviejų paskyrų nuomos ciklas (REZERVACIJA B)
**B paskirtis – sutartys, vienkartinis PIN, perdavimas ir grąžinimas; B nebandyti atšaukti po perdavimo.**
1. Tiekėjas turi skelbimą su **2–5 nuotraukomis**; nuomininkas jį randa paieškoje.
2. Sukuriama B rezervacija; nuomininko paskyroje ji matoma, tiekėjo paskyroje – tas pats B ID. Nei vienoje paskyroje nesimato svetimų užsakymų ar meniu.
3. Tiekėjas patvirtina, nuomininkas atsiskaito **tik TEST**, jeigu B reikalingas mokamas pilnas scenarijus. Jei rinktumeisi atskirą demonstracinį mokėjimą B, būtinai pažymėk jį kaip **demo**, ne Stripe patvirtinimą; laikyk atskirą nuo A.
4. Prieš pasirašant: **nei nuomininko, nei tiekėjo pusė neturi atskleisti perdavimo kodo**.
5. Nuomininkas patvirtina savo sutartį; patikrink, kad nebelieka pakartotinio aktyvaus „pasirašyti“ mygtuko. Iki tiekėjo sutikimo kodo negalima gauti.
6. Tiekėjas patvirtina **savo** sutartį. Tik po abiejų parašų ir būtinų mokėjimo/būsenos sąlygų nuomininko pusėje atsiranda vienkartinis atsiėmimo kodas; tiekėjas jo pats negeneruoja.
7. Tiekėjas suveda nuomininko kodą ir pažymi išdavimą. Tikėtina `active`. Tas pats kodas antrą kartą turi būti atmestas. Kodo galiojimas iki panaudojimo, ne 15 min.
8. Grąžinimą **be papildomo nuomininko kodo** patvirtina pats tiekėjas, nurodęs daikto būklę. Tikėtina `returned` / užbaigtas leidžiamas procesas.
9. Patikrink matomą galutinę būseną abiejose paskyrose, žinutes ir bent vieną ginčo pateikimo kelią, jei saugu testuoti atskiroje B ar papildomoje sintetinėje rezervacijoje. Neišgalvoti ginčo būsenos be realaus įrašo.

## 5. B3 – infrastruktūra, veikianti staging aplinka ir pranešimai
1. Railway patikrink faktinį `staging` deploy, sveikatą, privalomų kintamųjų **buvimą** (neatversk paslapčių), S3 backup `last-verified-backup.json` ir atkūrimo testo įrodymą **tik laikiname kataloge**.
2. Patikrink HTTPS ir staging domeną, naršyklėje atverk keturis viešus preflight API iš 2 skyriaus.
3. Testinėms A/B rezervacijoms patikrink, ar pranešimai iš tiesų pasiekė adresatus. `email_worker_started` nėra pristatymo įrodymas; rink arba tiekėjo/nuomininko testinių pašto dėžučių patvirtinimą, arba paslaugos pristatymo statuso įrodymą. Nesiųsti į realių klientų adresus.
4. Peržiūrėk kritines klaidas (500, kredencialų atskleidimas, sesijų/cookie saugumas). Nefiksuoti „PASS“ vien dėl to, kad serveris `ready=true`.

## 6. B4 – teisinis preflight (rekvizitus užpildyti tik paskutinėje stadijoje)
- Patikrink `/terms`, `/privacy`, `/cookies`, nuomos sutarties redakciją, tiekėjo taisykles, atšaukimą/refundą, ginčų ir vartotojo kontaktų maršrutus, fizinio asmens ir verslininko statuso atskyrimą.
- Iš anksto pasiruošk laukus: veiklos vykdytojo patvirtinti rekvizitai, IV veiklos identifikatoriai, EVRK atitiktis, kontaktinis el. paštas, adresas, galutinės privatumo duomenų saugojimo ir teisių nuostatos. **Nesugalvok jų, nepublikuok tarpinių / fiktyvių rekvizitų.**
- Vartotoja patvirtino, kad jau turi individualią veiklą, ir aiškiai nurodė EVRK / rekvizitus užpildyti **prieš pat viešą paleidimą**. Šį vieną žingsnį atidėk; visa kita gali būti suprojektuota iš anksto.
- Jei viešuose puslapiuose tebėra „nėra galutinė teisinė redakcija“, B4 lieka NO-GO mokamam viešam paleidimui. Neimituok teisinių dokumentų patvirtinimo.

B4 išsamus kontrolinis sąrašas: `docs/B4-LEGAL-READINESS-CHECKLIST.md` (parengiamasis dokumentas, ne vieša politika).\n\n## 7. B5 – privaloma baigiamoji ataskaita
Prie kiekvienos patikros nurodyk `PASS / FAIL / BLOCKED / NOT RUN` ir įrodymą (URL arba šaltinio įrašo ID, užsakymo ID, Stripe TEST PaymentIntent/Refund ID, commit, deployment, laiką). Slaptų tokenų ir pilnų asmens duomenų ataskaitoje netalpink.

| Blokas | Minimalus PASS įrodymas | 2026-11-09 žinoma būsena |
|---|---|---|
| B1 | Stripe TEST **A** €100 PI + susietas tiekėjas + tinkamas mokestis + signed webhook + booking paid + vienas refundas | Neatlikta |
| B2 | Reali **B** dviejų paskyrų naršyklės eiga, abu parašai, vienkartinis PIN, grąžinimas be antro PIN | Neatlikta |
| B3 | HTTPS, readiness/ops, DB backup+restore, realiai pristatyti testiniai laiškai | Staging penki HTTPS GET = 200 (2026-11-09 19:58 UTC), S3 backup+restore PASS; naujų A/B laiškų pristatymą dar patikrinti |
| B4 | Galutiniai teisiniai tekstai, operatoriaus identifikacija ir reikiamas atitikimas | Rekvizitai sąmoningai atidėti |
| B5 | B1–B4 PASS, nulis kritinių neatitikimų, dokumentuotas atšaukimo / grįžimo planas | NO-GO |

### Stop taisyklės
- Jei A susiejimo diagnostika rodo ne tą tiekėją/Stripe account – **STOP**.
- Jei Stripe objektas `livemode=true`, netikėtas application fee, ne ta suma/valiuta arba užsakymas – **STOP**.
- Jei neįmanoma atskirti nuomininko/tiekėjo sesijų arba yra duomenų nuotėkis – **STOP**.
- Jei payment succeeded, bet DB/unpaid, webhook neįvyksta arba grąžinimas dvigubinasi – **NO-GO**, fiksuoti visus įrodymus.
- Jei prašomas teisinis sutikimas ar realus veiksmas, reikalingas vartotojos sprendimas – sustoti tame žingsnyje.

## 8. Tekstas perduoti į Work trečiadienį
> Tęsk RentInOrbit MVP pagal **tik** `Piktoze/rentall` `staging/v203` ir Railway `nurturing-strength / staging`. Pirmiausia atsiversk šį protokolą `docs/WORK-2026-11-11-MVP-GO-NOGO.md` bei GitHub issue #3. Vykdyk preflight, B1 rezervaciją A (tikras Stripe TEST €100 Separate Charges and Transfers / SCT: PaymentIntent platformoje, teisingas connected tiekėjas, 15 % / 85 % pagal užsakymo snapshot, signed webhook, vienkartinis saugus refundas ir pervedimo suderinimas), B2 atskirą rezervaciją B (dviejų paskyrų sutartys, PIN, grąžinimas), B3 el. pašto ir readiness patikras, B4 be atidėtų IV rekvizitų ir B5 faktinę GO/NO-GO ataskaitą. Naudok valdomą naršyklę, neskelbk PASS be tikrų įrodymų. Neleisk mokėjimo iki tiekėjo patvirtinimo. Neliesk production, main, LIVE Stripe, /data, klientų duomenų; papildomas biudžetas 0 €. Jei reikės mano prisijungimo ar aiškaus sutikimo, sustok konkrečiai tame žingsnyje.



## 2026-11-20 tęsinys: tik esami blokatoriai

### Naujausia būsena po vartotojos Stripe TEST sąlygų patvirtinimo (17:40 UTC)

Ši būsena pakeičia toliau išsaugotą ankstesnio bandymo `restricted` / BLOCKED rezultatą.
Šaltinis: `docs/evidence/2026-11-20-sct-real-test.json`, kodas `92ab065`, Railway build
`b41d3479-477c-4879-945f-c41abef5fd30`. Stripe gavėjo tikrinimas praėjo po vartotojos
asmeniškai priimtų sąlygų; agentas jų nepriėmė.

- **A PASS**: naujas sintetinis €100 mokėjimas, abu sutarties sutikimai, atsiėmimo kodas,
  perdavimas, geros būklės grąžinimas, vienas €85 Transfer į Stripe gavėjo balansą.
  Programos būsena `returned / paid / transferred`; Stripe balanso padidėjimas 8500 ct.
- **B PASS**: atskiras naujas sintetinis €100 mokėjimas, atšaukimas iki perdavimo,
  €100 `succeeded` refund; programos būsena `cancelled / refunded / succeeded`.
- Tikri pasirašyti webhookai gauti vietiniu HTTP per Stripe CLI; du PI ir vienas
  `refund.created` įvykis užfiksuoti `processed`, pakartojimai atmesti kaip duplicate.
  Pakartotinis pervedimas/refundas atmesti; pervedimas iki grąžinimo, su sulaikymu
  ir su ginču užblokuotas. Sulaikymo/ginčo papildomi užsakymai sintetiniai, neapmokėti.
- 15 % komisinis = €15, tiekėjui €85; faktinis šio TEST kortelės apdorojimo mokestis
  €3,40 dengiamas platformos (lieka €11,60 prieš kitus kaštus). Tai nėra visų kortelių
  kainoraštis ar visų Connect kaštų įrodymas. Banko išmoka netikrinta.
- Naudota laikina SQLite bazė ir failų katalogas, po bandymo pašalinti; istorinių
  užsakymų ir `/data` nelietė. Vienkartinis bandymo paleidiklis po rezultato išvalytas.
- Tai tikras finansinio vykdymo ir webhook integracijos įrodymas, **ne** pilnas
  dviejų paskyrų telefono/naršyklės apmokėjimo E2E. B1 finansinis SCT blokatorius
  pašalintas; B2 galutinis naršyklės kelias, B3 pranešimų pristatymas, B4 pilni
  teisiniai dokumentai ir LIVE parengtis vis dar nėra bendras pilnos platformos GO.

- Pasveikinimo langas pašalintas commit `42c8e4c`; privati TEST prieiga lieka įjungta.
- Naujoje mobiliųjų ekranų patikroje rasti už 320–390 px ekrano ribų išeinantys prieinamumo datų laukai ir mygtukas. Taisymas naudoja susitraukiantį grid ir vieną stulpelį mažuose ekranuose; atskirai tikrinami rezervacijos, registracijos ir skelbimo nuotraukų įkėlimo langai.
- Šviežias tikros Stripe TEST API atsakymas: platforma `acct_1UT4JCLM72MR015z`, gavėjas `acct_1UdAsYLM72k4RDTw`, `livemode=false`, pervedimų galimybė `restricted`. Reikalavimai: `identity.attestations.terms_of_service.account.date` ir `.ip`, abu `awaiting_action_from=user`. B1/B2 finansinė dalis lieka **BLOCKED**; naujų PaymentIntent, Refund ar Transfer šiame bandyme nesukurta, nes sustota prieš finansinius veiksmus.
- `ops/sct-real-test-evidence.mjs` dabar nuskaito aiškiai nurodytą esamą sintetinį TEST gavėją. Jo iš naujo nekuria, nekeičia tapatybės/banko duomenų ar atsakomybių ir nepriima sąlygų. Tai apsaugo nuo naujos paskyros sukūrimo pasibaigus seno idempotency rakto galiojimui.
- Paruoštas A/B įrodymų rinkimas tik naujiems sintetiniams užsakymams laikinoje SQLite bazėje: Stripe sumos ir objektų ID lyginami su programos snapshot; PASS reikalauja tikrų apmokėjimo ir refundo webhook bei pakartojimo blokavimo. Paruoštas kodas nėra įvykdyto finansinio scenarijaus įrodymas.
- B4 rekvizitų gavimo būsena patikslinta `B4-LEGAL-READINESS-CHECKLIST.md`; jau pateiktų rekvizitų nelaikyti trūkstamais. Galutinis pilnos platformos teisinis/PVM/EVRK patvirtinimas ir LIVE parengtis lieka atviri. Katalogo ar privataus TEST veikimas jų neuždaro.
- Domeno/DNS prijungimas nebekartojamas. `/data`, istoriniai užsakymai, main, production ir LIVE finansinės operacijos nekeičiami.

- Papildoma mobiliųjų ekranų patikra aptiko progreso juostos uždengiamą rezervacijos uždarymo mygtuką. Pataisa suteikia uždarymui aukštesnį sluoksnį ir atskiria jam vietą nuo juostos; testas naudoja įprastą paspaudimą be `force`.
- Kad nereikėtų nematomo naršyklės perėmimo, patvirtintam privačios TEST prieigos savininkui pateikiamas mygtukas „Užbaigti Stripe TEST sąlygas“. Jis atidaro trumpalaikę oficialią esamos sintetinės TEST paskyros formą; privatūs URL pokalbyje neskelbiami. Kiti pakviesti adresai tokios teisės negauna. Pats mygtukas sąlygų nepriima ir finansinių veiksmų neatlieka.
