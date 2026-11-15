# RentInOrbit – 1/26. Stripe SCT architektūros sprendimo protokolas

Data: 2026-11-15. Šaka: `Piktoze/rentall staging/v203`. Apribojimai: tik GitHub dokumentas; **jokių LIVE, production, /data ar faktinių Stripe operacijų**.

**Būsena: dalinai patvirtinta / NO-GO LIVE.** Tai techninis tyrimas, ne Stripe individualus teisinis/komercinis patvirtinimas ir ne buhalterio išvada.

## Vienas konkretus verslo reikalavimas

Nuomininkas moka 100 EUR. Pradinė platformos komisinių apskaita – 15 EUR, tiekėjo – 85 EUR. Nuomotojas **negali gauti** savo dalies iki realiai patvirtinto daikto grąžinimo ir išspręstų finansinių blokatorių. Mokėjimai turi veikti Lietuvos IV operatoriui, privatiems ir verslo nuomotojams. Platforma nesiekia išrašyti savo vardu sąskaitų už kitam nuomotojui priklausančią 100 EUR paslaugą.

## Iš patikimų Stripe dokumentų patvirtinta

1. **Geografija:** Lithuania (LT) Stripe nurodyta kaip Separate Charges and Transfers (SCT) palaikoma teritorija.
2. **Pinigų kelias:** PaymentIntent/Charge yra **platformos** Stripe paskyroje. Vėlesnis Transfer į connected account yra atskira operacija; `transfer_group` tik susiejimui, `source_transaction` susieja su apmokėtu Charge ir lėšų prieinamumu.
3. **Atidėjimas:** SCT tinkamas modelis norint laukti daikto grąžinimo *prieš sukuriant Transfer*. Destination Charges perveda lėšas nedelsiant ir šio reikalavimo neužtikrina. Direct Charges taip pat netinka, nes tiekėjas gauna lėšų kontrolę anksti.
4. **Atsakomybė:** SCT mokėjimo processing fees, refunds ir chargebacks Stripe nuskaito iš **platformos** balanso; Stripe apibūdina platformą kaip merchant of record Stripe mokėjimo modelyje. Tai NEĮRODO, kad platforma pagal Lietuvos PVM / nuomos teisinius dokumentus privalo išrašyti sąskaitą už visą nuomą: būtinas atskiras teisinis ir mokestinis vertinimas. Bet yra tikras galimas neatitikimas pageidaujamam gryno tarpininko modeliui.
5. **Connected account:** Accounts v2 Recipient + `stripe_balance.stripe_transfers` reikalinga pervedimams; `dashboard=express` leidžia valdomą dalinę prieigą. Rekomenduojamas suderinamumo kandidatas: Dashboard Express; fee collection – platforma (`fees_collector=application`); negative balance liability – platforma (`losses_collector=application`). Šios vertės turi būti patvirtintos Stripe dar prieš kuriant paskyras; jos gali būti nekeičiamo pobūdžio ir sukelia platformai papildomą atsakomybę.
6. **Įmokų ir išmokų skirtumas:** `Transfer` (platforma → connected Stripe balansas) ir `Payout` (Stripe balansas → bankas) nėra tas pats. 90 dienų manual payout limitas Stripe dokumentacijoje galioja **laikymui susietos paskyros balanse** daugumoje šalių, bet jo negalima laikyti patvirtintu **platformos SCT charge-to-transfer limitu**. Stripe aiškiai nurodo, kad nepalaiko escrow sąskaitų.
7. **Nuomos trukmė:** kol nėra Stripe rašytinio patvirtinimo dėl konkrečių SCT transfer terminų, negalima žadėti neribotos nuomos trukmės ar neriboto pinigų atidėjimo. Ilgoms nuomoms reikia neleidžiamos trukmės blokavimo arba atskiro patvirtinto mokėjimo grafiko.
8. **Kaina (viešas orientyras, ne individualus pasiūlymas):** standartinei EEE kortelei LT 1,5 % + 0,25 EUR = 1,75 EUR nuo 100 EUR. 15 EUR komisinis minus 1,75 EUR = 13,25 EUR **prieš** Connect, refund, ginčų, mokesčių ir operacinius kaštus. Kitos kortelės ir Connect planai kainuoja kitaip. `application_fee_amount` **nenaudoti SCT**: 85 EUR pervedimo dydis apskaičiuojamas atskirai.
9. **Refund/dispute:** iki Transfer pilnas 100 EUR refund yra platformos finansinė atsakomybė. Po Transfer gali tekti `transfer_reversal`, bet grąžinimo galimybė ir likučiai negarantuoti; būtina apskaitos ir rizikos taisyklė.

## RentInOrbit įgyvendinimo sutapimas

- Moduliuose įrašytas izoliuotas SCT TEST mokėjimo, read-only Stripe finansų, refundų ir pervedimų planavimo kodas.
- Nauji SCT moduliai nėra prijungti prie viešų `server.js` checkout kelių. Legacy Direct Charges apriboti SCT bookingams.
- Finansinių komandų žurnalai turi būti kuriami valdomoje TEST migracijoje; pirminiame DB inicijavimo faile nėra abiejų registrų inicijavimo.
- Tikras naujos €100 SCT TEST rezervacijos ciklas, refundas ir €85 Transfer iki šiol nepatvirtinti.
- LIVE Stripe ir production sąmoningai išjungti.

## 1 punkto baigtinis priėmimo kriterijus

1. **[PASS – dokumentai]** Stripe oficialiai palaiko SCT Lietuvoje ir galimybę atidėti Transfer iki grąžinimo.
2. **[OPEN – Stripe paskyra]** Patikrinti realios LT operatoriaus Stripe paskyros leidžiamus SCT, Accounts v2 Recipient, `stripe_transfers`, Express ir negative-balance atsakomybės parametrus.
3. **[OPEN – laikymo terminas]** Stripe Support raštu patvirtinti platformos SCT lėšų laikymo ir Charge→Transfer laiko ribas; taip pat sprendimą ilgoms nuomoms ir atvejui, kai balansas jau išmokėtas platformai.
4. **[OPEN – mokestiniai dokumentai]** Lietuvos buhalteris / teisininkas turi raštu patvirtinti, ar Stripe SCT platformos merchant-of-record statusas suderinamas su atsiskleidusio tarpininko sutartimis ir platformos sąskaita tik už 15 EUR. Jei nesuderinama, sustabdyti SCT ir iš naujo rinktis teisinę/pinigų architektūrą.
5. **[OPEN – mokėjimo ekonomika]** Patikrinti faktinį Stripe kortelių, Connect, išmokų, chargeback ir refund pricing konkrečioje platformos paskyroje. Finansinių nuostolių rezervas ir kas moka mokesčius – dokumentuotas.
6. **[OPEN – techninis patvirtinimas]** Pirmiausia TEST E2E su naujomis synthetic rezervacijomis; jokių viešų ar LIVE mokėjimų iki įrodymų.

**Punktas #1 lieka ATVIRAS**, nors SCT kaip techninis modelis preliminariai tinkamas. Nepainioti su atskiru #2 onboarding ir #3–7 visos mokėjimo grandinės darbais.

## Stripe originalūs šaltiniai (tikrinti pasikeitus sąlygoms)
- https://docs.stripe.com/connect/marketplace/tasks/accept-payment/separate-charges-and-transfers
- https://docs.stripe.com/connect/marketplace/tasks/accept-payment
- https://docs.stripe.com/connect/accounts-v2
- https://docs.stripe.com/connect/accounts-v2/connected-account-configuration
- https://docs.stripe.com/connect/manual-payouts
- https://docs.stripe.com/connect/manage-connected-account-payouts
- https://docs.stripe.com/connect/account-balances
- https://stripe.com/en-lt/pricing
- https://stripe.com/connect/pricing
