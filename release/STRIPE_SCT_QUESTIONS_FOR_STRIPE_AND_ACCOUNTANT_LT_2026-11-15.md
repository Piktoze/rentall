# RentInOrbit – 1/26. Klausimai Stripe ir LT apskaitai prieš SCT paleidimą

**Parengta:** 2026-11-15. **Būsena:** parengta išsiuntimui, **NEIŠSIŲSTA**. Nėra Stripe individualaus leidimo ar teisinės išvados. Šaka `staging/v203`; nieko nejungti LIVE.

## 1. Stripe Support – English, ready to send

**Subject:** Lithuania marketplace: Accounts v2 recipient + separate charges and transfers; transfer delay limits and merchant-of-record responsibilities

Hello Stripe Connect team,

We operate **RentInOrbit**, a Lithuania-first peer-to-peer and business-to-consumer item rental marketplace. The platform operator is currently an individual carrying out registered economic activity in Lithuania. Our suppliers can be Lithuanian private individuals or registered businesses. We are evaluating Separate Charges and Transfers (SCT), without `on_behalf_of`, and Accounts v2 recipient connected accounts with Express dashboard.

Our required funds flow is: renter pays EUR 100 to our platform, the platform records a 15% service commission (EUR 15), and **no EUR 85 Transfer is created** until the rented item is confirmed returned and all disputes/refunds/financial holds are cleared. The platform would own Stripe processing fees, refunds and dispute operations. We will not use the destination-charge pattern, which transfers funds to the supplier too early.

Could you please confirm **specifically for a Lithuania-based individual-activity platform and Lithuanian private/business recipients**:

1. Does this entity/business model qualify for SCT and Accounts v2 **recipient** accounts? Are private individuals who intermittently rent movable goods eligible recipients, and are there restricted/prohibited activity categories we need to enforce?
2. Is **Express Dashboard + platform-managed pricing + platform negative-balance liability** supported for this exact SCT pattern in our account? Is `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status=active` the gating capability for a recipient? Are any additional capabilities required for recipient bank payouts and for platform card charges?
3. What is the **actual maximum permissible interval from successful platform card Charge until creation of an SCT Transfer** in Lithuania? Is the maximum measured from authorization, capture, funds availability or another event? What happens if an item's rental period is longer? Please distinguish this from the 90-day **manual payout** maximum applicable after funds reside in a connected account.
4. Can Stripe automatically **pay out platform charges to the platform's bank account** before a deferred SCT Transfer? If so, what platform balance reserve / payout scheduling controls, funding rules or reconciliation mechanisms must we implement to ensure the subsequent supplier Transfer can be funded? Is `source_transaction` suitable when the charge funds have already left the Stripe platform balance?
5. Does SCT create a **platform merchant-of-record** classification for these transactions? What payment receipt/statement descriptor requirements apply, and does Stripe have restrictions on using SCT for a **disclosed intermediary** that invoices only its 15% commission while suppliers are the legal lessors providing the EUR 100 rental service? We understand Lithuanian tax/legal implications require separate advice.
6. If a refund, dispute or reversal occurs **before and after** Transfer, which Stripe balances are debited; what is the process when the recipient has insufficient funds; what are applicable negative-balance liability and recovery responsibilities?
7. Which Stripe **card processing, Connect account, active-recipient, Transfer, Payout, refund and dispute** fees apply in our Lithuania account, including private individuals vs businesses? Is a particular Connect plan required?
8. For our TEST setup, can you identify any Stripe capabilities, restrictions, or onboarding requirements preventing a controlled synthetic EUR 100 charge and delayed EUR 85 SCT Transfer?

Please cite the current Stripe documentation or account-specific applicable agreement, and if any issue is governed by a maximum holding duration, provide the **exact maximum number of days and its starting event**. We are not asking Stripe to provide escrow; we are seeking a compliant transfer-after-return workflow.

Thank you.

## 2. Lietuvos buhalteris / teisininkas – parengtas klausimų tekstas

**Tema:** RentInOrbit 15 % tarpininkavimo komisinių, 100 € nuomos atsiskaitymo ir dokumentų išrašymo modelio vertinimas

Sveiki,

Vertiname Lietuvoje veikiančią internetinę daiktų nuomos tarpininkavimo platformą RentInOrbit. Operatorius vykdo individualią veiklą; daiktus gali nuomoti fiziniai ir juridiniai asmenys. Planuojama, kad klientas už nuomą sumoka 100 €, platformos tarpininkavimo komisiniai yra 15 €, o likę 85 € po daikto grąžinimo per Stripe Connect Separate Charges and Transfers perduodami nuomotojui.

Stripe SCT atveju mokėjimas surenkamas platformos Stripe paskyroje, o atskiras Transfer išsiunčiamas nuomotojui. Stripe šį modelį mokėjimų požiūriu apibūdina kaip platformos merchant-of-record; tuo pačiu civilinė nuomos sutartis būtų tiesiogiai tarp daikto nuomotojo ir nuomininko, o RentInOrbit – aiškiai atsiskleidęs tarpininkas.

Prašome raštu įvertinti:
1. Ar tokį modelį teisiškai ir mokestiškai galima traktuoti kaip atsiskleidusio tarpininko veiklą, kai **platformos atlygis yra tik 15 €**, nors jos Stripe sąskaita techniškai surenka 100 €? Kokios sutarties ir pinigų apskaitos sąlygos būtinos? Ar SCT merchant-of-record statusas kelia nesuderinamumo riziką?
2. Kokius dokumentus turi gauti nuomininkas iš privataus nuomotojo, juridinio nuomotojo ir iš platformos? Kai nuomininkas juridinis asmuo, o nuomotojas privatus, koks teisingas sandorį pagrindžiantis dokumentas – nuomos sutartis, sąskaita ar kitas dokumentas? Kas jį išrašo?
3. PVM taikymas platformos komisiniams ir nuomos sumai (įskaitant PVM mokėtojo ir ne PVM mokėtojo nuomotojus), pajamų pripažinimas, išrašomų dokumentų rekvizitai.
4. Ar iš privatiems nuomotojams ir juridiniams nuomotojams išmokamų sumų platformai atsiranda GPM, išskaičiavimo, deklaravimo ar kitų mokestinių pareigų?
5. Ar platformai konkrečioms veikloms taikomos DAC7 ataskaitų pareigos, atsižvelgiant į tai, kad nuomojami **daiktai** (ne visas veiklas galima sutapatinti su transporto priemonių nuoma, nekilnojamuoju turtu ar prekių pardavimu)?
6. Kaip apskaitomi daliniai ir pilni refundai, ginčai, Stripe mokesčiai, neigiami likučiai, klientų depozitai ir jų grąžinimas?
7. Kokios papildomos sąlygos reikalingos tarpininkavimo taisyklėse, nuomos sutartyje bei skaidrioje išankstinėje informacijoje, kad klientui būtų teisingai aišku, kas yra daikto nuomos paslaugos teikėjas?

Prašome aiškaus sprendimo **GO / pakeisti modelį / NO-GO** prieš įjungiant realius mokėjimus.

## 3. Kodėl šiuos atsakymus būtina gauti

- `Stripe Transfer` (platforma → connected account) nėra `Stripe Payout` (connected account → bankas). Dokumentuota 90 dienų manual payout taisyklė savaime neįrodo Charge→Transfer leidžiamos trukmės.
- SCT laiko kontrolė techniškai užtikrinama tik jei **prieš grąžinimą nėra sukurtas Transfer**, o ne jei Transfer išsiųstas anksčiau ir sąskaitoje laukiama Payout.
- Platformos 15 € komisinių marža prieš Connect, ginčų, administravimo ir mokesčių sąnaudas skaičiuojama atskirai. Negalima priskirti pilnų 100 € pajamų / ne pajamų statuso vien iš Stripe API modelio.
- Kol atsakymų nėra, **nenustatyti savavališko maksimalios nuomos trukmės skaičiaus** ir neatidaryti SCT LIVE.

## 4. Susiję kodo darbai, kurie bus vykdomi tik patvirtinus modelį

- Accounts v2 recipient (privačiam ir verslo nuomotojui) naujų paskyrų saugus prijungimas.
- Testinės paskyros `recipient.stripe_balance.stripe_transfers` capability ir bank payouts pasirengimo įrodymas.
- Griežtas nuskaitymo ir vėlyvo 85 € Transfer valdymas, tik po grąžinimo.
- Platformos likučio finansavimo ir lėšų prieinamumo patikra prieš Transfer, nepainiojant Transfer su Payout.
- €100/€15/€85 ir realių Stripe fee, refund/dispute, tax ledgerių atskyrimas.
- Dvi naujos TEST rezervacijos ir realūs, iš Stripe Dashboard perskaityti mokėjimo, refundo ir pervedimo objektai.

## Originalūs Stripe šaltiniai
- https://docs.stripe.com/connect/marketplace/tasks/create
- https://docs.stripe.com/connect/integrate-billing-connect
- https://docs.stripe.com/connect/separate-charges-and-transfers
- https://docs.stripe.com/connect/manual-payouts
- https://docs.stripe.com/connect/accounts-v2
- https://docs.stripe.com/connect/accounts-v2/connected-account-configuration
- https://stripe.com/en-lt/pricing

**Kontrolė:** 1/26 punkto būseną pakeisti į PASS tik pateikus Stripe paskyrai taikomą patvirtinimą, buhalterio/teisininko išvadą ir techninį TEST įrodymą. Šis failas tėra parengti klausimai; jų išsiuntimas ar gavimas nepatvirtintas.
