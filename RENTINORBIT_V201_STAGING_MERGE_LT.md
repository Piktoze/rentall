# RentInOrbit v201 – staging hotfixų sujungimas

Data: 2026-11-03. Pagrindas: pilnas v200 ZIP + naudotojos pateiktas `staging_hotfix_sources_REVIEW.zip`.

## Rezultatas

- Staging archyve rasta **16 pataisų įrašų**. **14 aktyvių diegimo pataisų** sėkmingai pritaikytos šaltinio kopijai; `STAGING_PATCH_LIFECYCLE_GUARDS` pritaikytas per `STAGING_PATCH_EMAIL_RETRY` kaip priklausomybė. `STAGING_PATCH_JSON` jau atitinka v200 `apiJson` headers tvarką, todėl papildomo keitimo nereikia.
- Checkout, tiekėjo patvirtinimo, e. laiškų, mokėjimo nuorodų, mokėjimo terminalinių būsenų, atšaukimo UI ir serverio pataisos perkeltos į bendrą kodą.
- Senas dinaminis vertimų hotfix nebenaudoja atskiro `MutationObserver` – jo žodyno frazės ir kintamųjų formos sujungtos į pagrindinį `modules/i18n-v161.js` vertimų variklį. **Vienas** vertimo stebėtojas.
- CSS, JS, vertimų ir service worker talpyklos versija – `v201`.
- `staging-merge-v201.test.cjs` tikrina vertimo variklio unikalumą ir pagrindinių pataisų buvimą.

## Patikros

- `node release/rc-gate.js`: **15 / 15 PASS**.
- `node language-audit-v198.test.cjs`: **PASS**; 5 kalbos, 775 frazės po suderinimo.
- `node i18n-v161.test.js`: **PASS**; 769 bazinės frazės (papildomos staging frazės prijungiamos vykdymo metu).
- `node staging-merge-v201.test.cjs`: **PASS**.
- `node cache-consistency-v200.test.cjs`: **PASS** (testas pritaikytas v201 versijai).
- Plataus statinio rinkinio rezultatas: **126 / 144 PASS**. Likę 18 nepraėjimų – daugiausia senos versijos lūkesčiai arba neįdiegtos lokalios Node priklausomybės. Tai nėra praeitas visos sistemos E2E.

Nepraėję testai: architecture-v112.test.js, auth.test.js, availability.test.js, deployment-runtime-v147.test.js, deposit-finalization-v100.test.js, deposit-stripe-v99.test.js, expiration.test.js, full-demo-v180.test.js, production-foundation-v146.test.js, public-focus-v176.test.cjs, renter-alternatives-v191.test.js, renter-booking-status-v190.test.js, renter-response-deadline-v189.test.js, staging-mode.test.js, supplier-ux-v178.test.cjs, supplier-ux-v179.test.cjs, trust.test.js, ux-cleanup-v193.test.js.

## Kritinė pastaba prieš Railway staging įkėlimą

**Nediegti šio ZIP tiesiai per seną staging build komandą.** Dabartinis Railway staging `buildCommand` dekoduoja ir iš naujo įterpia `STAGING_PATCH_*` turinį į GitHub `main`. Kadangi v201 pakeitimai jau įtraukti, pakartotinis pataisų vykdymas gali sugadinti kodą ar nulaužti build. Reikia prieš staging diegimą pakeisti tik `staging` aplinkos build komandą į švarų v201 patikrų/build veiksmą ir aiškiai išsaugoti seną build komandą rollbackui. **Production konfigūracijos nekeisti.**

**Nediegti tol, kol nepadaryta patikrinta `/data` SQLite atsarginė kopija** (įskaitant WAL/SHM arba nuoseklią SQLite backup API kopiją). Railway volume neperrašyti. Nenaudoti atsitiktinio naujo volume, kuris paslėptų duomenis.

GitHub `main` taip pat netinka šiam etapui: dabartinės integracijos šakų rašymo operacijos grąžina `403`. Galimas saugus diegimas iš lokalaus projekto per Railway CLI, aiškiai nurodant staging project/environment/service, tik atskirai įvertinus Railway konfiguraciją. CLI diegimas šioje sesijoje neatliktas.

## Kas dar nepatikrinta

- Reali staging Stripe TEST rezervacija → tiekėjo patvirtinimas → apmokėjimas → partial/full refund → mokėjimo webhook → komisinių grąžinimas.
- El. laiškų faktinis gavimas, pilnas browser E2E su LT, EN, ES, DE, RU, DB migracijų grįžtamumas.
- Viešos produkcinės teisinės sąlygos ir LIVE Stripe Connect.

**Būsena: ZIP SUJUNGTAS, STATINĖS PATIKROS ATLIKTOS, STAGING NEDIEGTAS, PRODUCTION NEPAKEISTAS.**
