# RentInOrbit — slapukų, saugyklos ir trečiųjų šalių inventorius (V252)

**Staging auditas, 2026-11-09.** Šis dokumentas remiasi kodo peržiūra, ne pilnu automatizuotu naršyklės tinklo / slapukų skenavimu. Todėl viešo paleidimo teisinės patikros statusas **NO-GO**.

| Priemonė | Kada naudojama | Paskirtis | Veiksmas |
|---|---|---|---|
| `rentinorbit_session` (HttpOnly, SameSite=Lax, iki 14 dienų; Secure su HTTPS) | Prisijungus | Autentifikavimas, saugumas | Būtinas, sutikimo lango dėl jo nereikia |
| `localStorage`: kalbos, paieškos, filtrai, skelbimų ir sąsajos nuostatos | Naudojant konkrečias funkcijas | Naudotojo pasirinkimų ir nebaigto proceso išlaikymas | Privaloma peržiūrėti duomenų kategorijas ir jų poreikį |
| `localStorage`: rezervacijos prieigos raktai, kliento el. paštas ir serverio profilio kopija | Rezervacijose / paskyroje | Tęstinumas | Atvira saugumo peržiūra: mažinti jautrių duomenų išlaikymą ir dalijamo įrenginio riziką |
| `localStorage`: senas tiekėjo profilis | Istorinis MVP modulis | Senas prototipas | V252 šalina iš jo IBAN, mokesčių ID ir plaintext slaptažodžius, kai duomenys nuskaitomi; nauji įrašai filtruojami |
| Google Fonts išoriniai ištekliai | Pradinis puslapio atidarymas | Šriftai | Užklausose trečiajai šaliai gali būti siunčiamas IP / user-agent; reikia apsvarstyti sistemos šriftus / lokalius išteklius |
| Leaflet CSS/JS per `unpkg.com` | Pradinis puslapio atidarymas | Žemėlapio biblioteka | Išorinio tiekėjo užklausos dar vyksta prieš žemėlapio naudojimą; įvertinti lokalų / dinaminį įkėlimą |
| OpenStreetMap plytelės | Atidarius / naudojant žemėlapį | Žemėlapio rodymas | Atvaizdavimo metu išorinėms tarnyboms gali būti siunčiami IP, peržiūrima vieta, techniniai metaduomenys |
| Stripe Connect `connect-js.stripe.com` | Tik pradėjus tiekėjo mokėjimo paskyros prijungimą | Tiekėjo KYC / mokėjimų valdymas | V252 pašalina visuotinį scenarijaus įkėlimą ir įkelia tik inicijavus prijungimą |
| Stripe.js `js.stripe.com` | Tik pradedant mokėjimą | Mokėjimo apdorojimas | Būtina patikrinti Stripe slapukų elgseną ir juridinius pranešimus |
| Analitika / reklaminiai pikseliai | Šiuo metu neaptikta pirmosios šalies įjungtų integracijų | Nebūtina | Negali būti pridėti be išankstinio aiškaus sutikimo ir tokio pat lengvo atsisakymo / atšaukimo |
 
## Sprendimas dėl sutikimų valdymo

Dabartiniame pirmosios šalies kode nėra aktyvių Google Analytics, Meta Pixel ar analogiškų reklaminių sekiklių. **Nekuriamas dekoratyvus „Sutinku su visais“ langas**, kai nėra sukonfigūruotų nebūtinų sekiklių, kuriuos būtų galima realiai įjungti arba išjungti. Kai nebūtini sekikliai bus įdiegti, jie turi būti pagal nutylėjimą išjungti ir aktyvuojami tik gavus galiojantį sutikimą. „Nesutinku“ ir „Sutinku“ – vienodai prieinami; atsisakymas neturi blokuoti būtino svetainės funkcionalumo; sutikimo atšaukimas turi veikti.

## Atviri GO/NO-GO klausimai

1. Tikru naršyklės testu užfiksuoti tinklo užklausas, `document.cookie`, Local/Session Storage ir trečiųjų šalių slapukus prieš / po prisijungimo, žemėlapio, Stripe Connect ir mokėjimo naudojimo.
2. Patikrinti Google Fonts, unpkg ir OpenStreetMap užklausų teisinį pagrindą ir duomenų perdavimus; išankstinio sutikimo būtinumą vertinti pagal faktiškai naudojamas technologijas, ne vien tiekėjo pavadinimą.
3. Atskirai spręsti jautrių guest rezervacijos prieigos raktų ir kliento kontaktų saugojimo naršyklėje saugumą.
4. Patvirtinti realią privatumo ir slapukų politikos redakciją, operatoriaus rekvizitus ir galiojančius saugojimo terminus.
5. Jei atsiras nebūtinas sekimas, prieš įjungiant įdiegti veikiantį opt-in pasirinkimą ir atkuriamą sutikimo istoriją.

## Šaltinis

VDAI, 2026-07-23: https://vdai.lrv.lt/lt/naujienos/vdai-primena-butina-uztikrinti-tinkama-slapuku-ir-kitu-sekimo-technologiju-naudojima-Xad/
