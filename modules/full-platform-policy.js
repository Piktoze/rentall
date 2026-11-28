// Factual Lithuanian platform text. Unconfirmed tax/retention decisions stay explicit.
// No catalog-only promises, no invented VAT status or provider deletion period.
import {operatorTaxProfile} from './operator-tax-profile.js';
export function fullPlatformPolicy(page,{key,lang='lt',env=process.env}={}){
 if(lang!=='lt')return page; // Other locale final review remains a launch blocker.
 const result=structuredClone(page),contact='info@rentinorbit.com';
 const identity=['LEGAL_OPERATOR_NAME','LEGAL_IV_CERTIFICATE','LEGAL_OPERATOR_ADDRESS'].map(k=>String(env[k]||'').trim());
 const operator=identity.every(Boolean)?`${identity[0]}, individualios veiklos pažyma Nr. ${identity[1]}, korespondencijos adresas: ${identity[2]}.`:'Operatoriaus rekvizitai nepatvirtinti – komercinis paleidimas blokuojamas.';
 const tax=operatorTaxProfile(env);
 const vat=tax.vatMode==='not_vat_registered'?'Operatorės pateiktas dabartinis statusas – ne PVM mokėtoja. Prievolės dėl užsienio paslaugų vertinamos atskirai; šis statusas nėra pažadas, kad registracijos nereikės ateityje.':'Operatorės PVM statusas šiai redakcijai dar turi būti patvirtintas.';
 const activity=tax.activityCode&&tax.classification?`Veiklos kodas: ${tax.activityCode} (${tax.classification}).`:'Veiklos kodas dar nepatvirtintas.';
 const shared=[['Operatorius ir dokumento taikymas',[operator,activity,vat,`Kontaktas, skundai ir privatumo prašymai: ${contact}. Redakcija: 2026-11-28 (komercinio paleidimo peržiūrai). Ši redakcija skirta pilnai rezervavimo platformai. Privačiame TEST režime operacijos yra sintetinės; jis nesuteikia leidimo vykdyti tikrų mokėjimų. Istorinių rezervacijų išsaugotos sąlygos nekeičiamos.`]]];
 if(key==='terms'){
  result.intro='RentInOrbit tarpininkavimo, rezervavimo, nuomos sutarčių, perdavimo, grąžinimo ir ginčų taisyklės.';
  result.sections.push(['Nuomotojo statusas ir nuomos dokumentai',[
   'Nuomos sutarties šalys yra konkretus nuomotojas ir nuomininkas. Nuomotojo verslininko arba privataus asmens statusas nustatomas prieš užsakymą; vien pasirinkimas profilyje nepakeičia faktinės veiklos statuso. Platformos komisinio paslaugos sutartis yra atskira nuo daikto nuomos.',
   'Nuomojantis iš verslininko vartotojo privalomos teisės išlieka. Dviejų privačių asmenų ir dviejų verslo subjektų nuomai vartotojų ginčų taisyklės automatiškai nepriskiriamos. Įmonei nuomojantis iš privataus arba nepatikrinto nuomotojo apmokėjimas blokuojamas, kol suderinta mokesčių ir apskaitos tvarka.',
   'Platforma išrašo dokumentą tik savo komisiniui. Dokumentą už nuomą išrašo faktinis nuomotojas, kai jam taikoma ši prievolė, arba jo tinkamai įgaliotas asmuo. Sandorio patvirtinimas ir Stripe mokėjimo kvitas nėra automatiškai nuomotojo sąskaita faktūra.'
  ]]);
  result.sections.push(['Skundai, ginčai ir atsakomybė',[
   `Užsakymo skiltyje „Pranešti apie problemą“ pateikite aplinkybes, reikalavimą, sutartį, būklės nuotraukas ir susirašinėjimą. Jei paskyros pasiekti nepavyksta, rašykite ${contact}, nurodydami užsakymo numerį. Nesiųskite kortelių duomenų ar nereikalingų asmens dokumentų.`,
   'Atviras ginčas ar finansinis sulaikymas blokuoja naują nuomotojo dalies pervedimą. Jau atlikto pervedimo negalima laikyti neatliktu; vėlesnis refundas ar ginčas reikalauja atskiro finansinio suderinimo. Užstatas nėra automatinė bauda ar draudimas; žalą ir jos dydį reikia pagrįsti.',
   'Į vartotojo rašytinį skundą verslininkas pateikia motyvuotą atsakymą ne vėliau kaip per 14 dienų. Nesusitarus dėl vartojimo ginčo galima kreiptis į VVTAT (vvtat.lrv.lt; VTIS – vtis.lt) arba teismą. Tai netaikoma automatiškai dviejų privačių asmenų nuomos ginčui ir neriboja privalomų teisių.',
   'Nuomotojas atsako už teisę nuomoti, saugumą, komplektaciją ir aprašymą; nuomininkas – už sutartą naudojimą bei grąžinimą, atsižvelgiant į įprastą nusidėvėjimą. Platforma atsako už savo tarpininkavimo paslaugą pagal taikomą teisę ir nežada automatinio visų nuostolių atlyginimo ar daikto draudimo.'
  ]]);
  result.sections.push(['Draudžiami skelbimai ir moderavimas',[
   'Platformoje draudžiama siūlyti ginklus, šaudmenis, sprogmenis, narkotines medžiagas, kontroliuojamus vaistus, pavogtus daiktus, klastotes, pavojingas chemines bei radioaktyviąsias medžiagas, asmens dokumentus, mokėjimo korteles ir svetimų paskyrų prieigą.',
   'Draudžiami nesaugūs, techniškai netvarkingi, dėl saugos oficialiai atšaukti gaminiai ir daiktai, kurių nuomai būtini specialūs leidimai, kol platforma neturi tinkamos leidimų patikros. Šis sąrašas apima platformos pasirinktus apribojimus ir nėra baigtinis teisės aktuose nustatytų draudimų sąrašas.',
   'Skelbimai prieš paskelbimą pateikiami moderuoti. Administratorius gali atmesti, apriboti ar pašalinti taisyklių neatitinkantį skelbimą; sprendimo priežastis pateikiama nuomotojui pagal taikomą tvarką. Dėl klaidingo sprendimo ar neteisėto skelbimo galima kreiptis į info@rentinorbit.com, nurodant skelbimo identifikatorių. Moderavimo patvirtinimas nėra daikto saugumo ar nuomotojo nuosavybės teisės garantija.'
  ]]);
  result.sections.push(['Nuomotojo atsakomybės patvirtinimai',[
   'Nuomotojas savanoriškai sprendžia, ar siūlyti daiktą nuomai ir ar priimti konkrečią rezervaciją. Registruojantis arba aktyvuojant nuomotojo paskyrą, pateikiant skelbimą bei priimant rezervaciją reikalaujama atskirų aiškių patvirtinimų. Esami nuomotojai prieš naują veiklą taip pat turi patvirtinti aktualias bendrąsias atsakomybės sąlygas.',
   'RentInOrbit neteikia daikto draudimo ir negarantuoja žalos, vagystės, praradimo ar negrąžinimo nuostolių atlyginimo. Nuomotojas pats sprendžia dėl tinkamo draudimo ir rizikos; nuomininko atsakomybė nustatoma pagal konkrečią sutartį, faktines aplinkybes ir taikomą teisę. Šalys dėl žalos atlyginimo pirmiausia kreipiasi viena į kitą, o platforma vykdo savo privalomas pareigas ir suteikia ginčo registravimo priemonę.',
   'Šios deklaracijos nėra visų galimų reikalavimų atsisakymas, kvalifikuotas elektroninis parašas ar nuomininko tapatybės garantija. Jos nepanaikina imperatyvių vartotojų teisių ar platformos atsakomybės už jos pačios veiksmus.'
  ]]);
  result.sections.push(['Nuomotojo atšaukimas',[
   'Iki daikto perdavimo nuomotojas gali inicijuoti atšaukimą, nurodydamas priežastį ir aiškiai patvirtindamas sprendimą. Jei nuoma apmokėta, grąžinama visa nuomos suma; atskira platformos atšaukimo bauda netaikoma. Pinigų grąžinimo būsena tikrinama pagal mokėjimo paslaugos duomenis.',
   'Po perdavimo taikomas nuomos vykdymo, grąžinimo arba ginčo procesas. Atšaukimo deklaracija ir mokėjimo rezultatas nėra tas pats įrodymas.'
  ]]);
  result.sections.push(['Mokėjimas, grąžinimas ir pervedimas',[
   'Mokama tik gavus būtiną nuomotojo patvirtinimą. Kiekviena šalis atskirai patvirtina išsaugotą nuomos sutartį. Nuomininkas gauna savo išdavimo kodą tik po savo sutarties patvirtinimo ir apmokėjimo; nuomotojas prieš fizinį perdavimą turi atskirai patvirtinti savo sutartį. Vienkartinis kodas nėra asmens tapatybės patikra.',
   'Daikto fizinį grąžinimą be antro kodo užfiksuoja nuomotojas. Tarpininkavimo paslauga užbaigiama tik abiem šalims atskirai patvirtinus tinkamą grąžinimą ir nesant neišspręsto ginčo, užstato ar kito išmokos sulaikymo. Tuo metu išrašoma platformos 15 % komisinio sąskaita ir inicijuojamas 85 % pervedimas į nuomotojo Stripe balansą. Stripe apdorojimo, Connect ir išmokų kaštus padengia platforma. Banko išmokos priklauso nuo Stripe paskyros patikros ir grafiko.',
   'Sutartinis atšaukimo grafikas rodomas prieš užsakymą ir išsaugomas konkrečioje rezervacijoje. Nuomotojui atšaukus iki perdavimo grąžinama visa nuomos suma. Nuomininko atšaukimas vertinamas pagal rezervacijos snapshot ir privalomas teises; po perdavimo automatinis atšaukimas neleidžiamas. Banko įskaitymo termino platforma negarantuoja. Techninės klaidos ar dubliuoto nuskaičiavimo atveju kreipkitės į pagalbą.'
  ]]);
 }
 if(key==='fees'){
 result.sections=result.sections.filter(([heading])=>heading!=='Mokesčiai, PVM ir sąskaitos');
 result.sections.push(['Dokumentų išrašytojas ir PVM statusas',[
  'Iš 100 € nuomos platformos komisinis yra 15 €, nuomotojo dalis – 85 €. Platformos dokumento gavėjas yra nuomotojas už tarpininkavimo paslaugą, o ne nuomininkas už visą 100 € nuomą. Nuomos dokumento išrašytojas yra faktinis nuomotojas; įgaliojimas išrašyti jo vardu turi būti atskirai patvirtintas.',
  vat+' Sąskaitų serija, numeravimo, kreditavimo ir apskaitos tvarka dar nepatvirtinti. Todėl tikrų sąskaitų automatinis išrašymas ir siuntimas blokuojami. Nuomotojas atsako už savo nuomos dokumentus ir mokesčius pagal faktinį statusą. Privataus nuomotojo dokumento tinkamumas įmonės apskaitai nepreziumuojamas.'
 ]]);}
 if(key==='privacy'){
  result.sections=result.sections.filter(([title])=>!['Su kuo duomenys gali būti dalijami','Saugojimas ir saugumas','Tavo teisės'].includes(title));
  result.sections.push(['Pagrindai ir nuomos šalių vaidmenys',[
   'Paskyros, rezervacijos, mokėjimo būsenų ir sutarčių duomenys tvarkomi sutarčiai vykdyti ar veiksmams prieš ją (BDAR 6 straipsnio 1 dalies b punktas), teisinėms prievolėms (c punktas), saugumui ir reikalavimų gynimui pagal dokumentuotą teisėtą interesą (f punktas). Jei naudojama pasirenkama rinkodara, jai reikalingas atskiras tinkamas pagrindas; registracija savaime nėra rinkodaros sutikimas.',
   'Nuomotojas ir nuomininkas gauna tik konkrečiai nuomai būtinus duomenis. Nuomotojas savarankiškai atsako už savo nuomos, mokesčių ir teisinių pareigų duomenų tvarkymą; duomenų gavimas nesuteikia teisės naudoti kontaktų reklamai. Nuomotojas automatiškai nelaikomas platformos duomenų tvarkytoju.'
  ]]);
  result.sections.push(['Faktiniai paslaugų teikėjai ir perdavimai',[
   'Railway talpina svetainę ir saugyklą; paskutinis patvirtintas regionas – JAV iad. Resend siunčia operacinius laiškus, Zoho ES paskyroje veikia info@rentinorbit.com. Porkbun valdo domeną ir DNS. Stripe tvarko mokėjimus ir tiekėjų patikrą; pagal paslaugą jis gali būti ir savarankiškas duomenų valdytojas, ir tvarkytojas. Kortelių ir Stripe patikros duomenys teikiami Stripe aplinkoje.',
   'Railway DPA papildo paslaugos sutartį, Resend nurodo DPA taikymą kiekvienai paskyrai, Stripe DPA įtrauktas į paslaugos sutartį. Konkrečių paskyrų sutarties šalis ir reikalingas už EEE ribų perdavimo priemones būtina užfiksuoti paleidimo registre. Zoho DPA užbaigimo nepatvirtina vien paskyros el. pašto patvirtinimas ar Stripe sąlygų priėmimas.',
   'Leaflet ištekliai gali būti gaunami iš unpkg.com, o žemėlapis – iš OpenStreetMap. Išorinių užklausų metu perduodamas IP adresas ir techniniai duomenys. Google Fonts nuorodos iš pagrindinio HTML pašalintos. ES pašto paskyra nereiškia, kad visi platformos duomenys tvarkomi ES.'
  ]]);
  const privateMode=env.PRIVATE_TEST_ENABLED==='true';
  const backupEnabled=!privateMode&&env.DB_BACKUP_ENABLED==='true'&&env.BACKUP_SCHEDULER_ENABLED==='true';
  result.sections.push(['Saugojimas pagal esamą režimą',[
   'Įprastos užklausos saugomos 12 mėnesių po išsprendimo, išskyrus dokumentuotą teisinį poreikį saugoti ilgiau. Šią taisyklę administruoja operatorė; automatinė pašto ištrynimo taisyklė nepatvirtinta.',
   privateMode&&env.PRIVATE_TEST_STORAGE_MODE==='persistent'?'Privatus TEST naudoja atskirai pažymėtą nuolatinės SQLite bazės ir failų katalogą. Automatinės kopijos šiame privačiame režime išjungtos; tai nėra klientų duomenų ar LIVE mokėjimų režimas.':privateMode?'Dabartinis privatus TEST naudoja laikiną /tmp SQLite bazę ir atskirą laikiną failų katalogą. Automatinės šios bazės atsarginės kopijos išjungtos. Duomenys nėra nuolatiniai ir gali dingti perkūrus konteinerį. Tai nėra klientų duomenų saugojimo režimas.':backupEnabled?`Konfigūracijoje kopijavimas įjungtas; intervalas: ${String(env.BACKUP_INTERVAL_HOURS||'nepatvirtintas')} val., naujausių kopijų riba: ${String(env.BACKUP_RETENTION_COUNT||'nepatvirtinta')}. Riba nėra garantuotas fizinio ištrynimo dienomis terminas; būtina patikrinti paskutinės kopijos ir atkūrimo įrodymus.`:'Šiai konfigūracijai veikiantis automatinis kopijavimas nepatvirtintas. Negalima žadėti jo intervalo ar ištrynimo termino.',
   'Atsakomybės deklaracijų ir sutarčių įrodymai apima paskyros identifikatorių, patvirtintą tekstą, redakciją, atsakymus, datą, susijusį skelbimą ar rezervaciją ir, kai taikoma, kontrolinę sumą. Administratoriui prieinamame archyve gali būti saugomi dokumentų PDF ir sandorio būsenų įrodymai. Slapti perdavimo kodai į šį eksportą neįtraukiami.',
   'Minimaliai būtinų sutartinių įrodymų saugojimo peržiūrai numatytas 10 metų laikotarpis nuo įsipareigojimų įvykdymo. Neišspręstiems ginčams ar finansinėms operacijoms taikoma papildoma peržiūra. Tai nėra visų asmens duomenų saugojimo terminas ar automatinio ištrynimo garantija. Konkretūs saugojimo pagrindai, apimtis ir šalinimo tvarka turi būti galutinai įvertinti prieš komercinį paleidimą.',
   'Railway žurnalų faktinis prieinamumas priklauso nuo paskyros plano. Prieigos langas nėra fizinio ištrynimo garantija. Pirminės bazės ištrynimas savaime neperrašo ankstesnių kopijų. Paskyrų, sutarčių, ginčų ir apskaitos įrašų kategorijų terminai bei periodinio ištrynimo tvarka dar turi būti patvirtinti prieš komercinį startą.'
  ]]);
  result.sections.push(['Duomenų subjekto teisės',[
   `Dėl susipažinimo, taisymo, ištrynimo, apribojimo, nesutikimo ar duomenų perkeliamumo, kai taikoma, rašykite ${contact}. Tapatybė tikrinama būtina apimtimi. Atsakoma nepagrįstai nedelsiant, paprastai per vieną mėnesį; teisės aktuose leidžiamas pratęsimas paaiškinamas. Galite skųstis VDAI (vdai.lrv.lt). Privalomų įrašų ištrynimas gali būti ribojamas teisės aktų ar dokumentuoto teisinio poreikio.`
  ]]);
 }
 if(key==='cookies')result.sections=result.sections.map(([title,paras])=>[title,paras.map(p=>p.replace('Šiuo metu pagrindinis puslapis naudoja Google Fonts ir Leaflet bibliotekos išteklius iš išorinio tiekėjo;','Pagrindinio HTML Google Fonts nuorodos pašalintos. Naudojami Leaflet bibliotekos ištekliai iš išorinio tiekėjo;'))]);
 result.sections.unshift(...shared);return result;
}
