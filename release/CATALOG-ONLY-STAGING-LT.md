# Katalogo režimo patikra ir domeno prijungimas

Įjungti `RENTINORBIT_CATALOG_ONLY=true` tik konkrečioje katalogo aplinkoje. Numatytoji reikšmė išjungta. Katalogo režimas atmeta visus rašymo veiksmus per /api, įskaitant registraciją, rezervacijas, Stripe ir webhook. Stripe klientas, ankstesnių užsakymų priežiūra ir el. pašto siuntimo darbuotojas katalogo režime nepaleidžiami. Prižiūrimas nuomos operacijas vykdyti atskiroje aplinkoje.

Viešą katalogą diegti atskirame, savininkės patvirtintame Railway katalogo servise. Dabartinis `rentall-staging.up.railway.app` yra techninė patikros aplinka. Prieš prijungiant domeną patikrinti, kad viešajame servise yra tik publikavimui patvirtintas inventorius, katalogo režimas įjungtas, registracija išjungta, o rekvizitai bei privatumo ir slapukų tekstai patvirtinti. Reikia atskiro savininkės GO.

Abu vardai šiuo metu grąžina 302 į `rentinorbit-com.l.ink`. Domeną valdo Porkbun vardų serveriai. `www` CNAME rodo į `uixie.porkbun.com`, o šakninio domeno A įrašai veda į tuos pačius IP. Tai Porkbun nukreipimo maršrutas. Staging Railway neturi šių priskirtų domenų.

Po leidimo:

1. Katalogo servise pridėti `rentinorbit.com` ir `www.rentinorbit.com` kaip Custom Domains. Nukopijuoti tikslius kiekvienam vardui Railway pateiktus CNAME ir TXT įrašus. Tikrieji tikslai sugeneruojami šiuo veiksmu.
2. Porkbun išjungti ankstesnį abiejų vardų URL persiuntimą. Pakeisti su juo konkuruojančius A arba CNAME įrašus. Šakniniam vardui naudoti Porkbun ALIAS į Railway nurodytą CNAME tikslą, o `www` – CNAME. Pridėti Railway nurodytus TXT. Išsaugoti nesusijusius pašto ir patvirtinimo įrašus.
3. Railway patikrinti DNS verifikaciją ir sertifikatus abiem vardams. Nustatyti vieną kanoninį HTTPS adresą. Jei pasirenkamas šakninis domenas, `www` į jį turi nukreipti su išsaugotu keliu ir užklausos parametrais.
4. Patikrinti HTTPS, mobilųjį katalogą, patvirtinto skelbimo 200, neegzistuojančio arba nepatvirtinto skelbimo 404 ir rezervavimo bei mokėjimo API 403. Patikrinti, kad katalogas neteikia Stripe rakto. Tik po to atidaryti viešą prieigą.

Šio darbo metu domenas neprijungtas ir DNS nebuvo keistas.
