
(function(){
  const SUPPORTED=['lt','en','es','de','ru'];
  const dictionaries={
    lt:{
      "Browse":"Naršyti","How it works":"Kaip tai veikia","For partners":"Tiekėjams","For suppliers":"Tiekėjams",
      "My bookings":"Mano užsakymai","Supplier login":"Tiekėjo prisijungimas","Notifications":"Pranešimai",
      "Discover":"Atrask","Location & dates":"Vieta ir datos","Choose":"Pasirink","Compare & availability":"Palyginimas ir prieinamumas",
      "Book":"Užsakyk","Details & payment":"Informacija ir apmokėjimas","Track":"Sek","Rent what you need, locally":"Nuomokis tai, ko reikia, netoliese",
      "Rent what you need. Skip buying it.":"Nuomokis tai, ko reikia. Nepirk be reikalo.",
      "Tools, furniture, electronics, event equipment and more — available from people and businesses nearby.":"Įrankiai, baldai, elektronika, renginių įranga ir dar daugiau — iš žmonių ir verslų netoliese.",
      "Near me":"Netoli manęs","For my trip":"Kelionei","Country":"Šalis","City":"Miestas","City / resort":"Miestas / kurortas",
      "What do you need?":"Ko ieškai?","Category":"Kategorija","Quantity":"Kiekis","From":"Nuo","To":"Iki","Search rentals":"Ieškoti",
      "Hotel or apartment":"Viešbutis arba apartamentai","Delivery":"Pristatymas","Find deliverable rentals":"Ieškoti su pristatymu",
      "Furniture":"Baldai","Tools & equipment":"Įrankiai ir įranga","Tools":"Įrankiai","Events & parties":"Renginiai ir šventės","Events":"Renginiai",
      "Electronics":"Elektronika","Photo & video":"Foto ir vaizdo įranga","Garden & outdoor":"Sodas ir laukas","Garden":"Sodas",
      "Trailers & transport gear":"Priekabos ir transporto įranga","Vehicles & transport":"Transportas","Baby & family":"Vaikams ir šeimai",
      "Sports & leisure":"Sportas ir laisvalaikis","Sports":"Sportas","Other":"Kita","All categories":"Visos kategorijos",
      "Browse by category":"Naršyti pagal kategoriją","Useful things without having to buy them":"Naudingi daiktai, kurių nebūtina pirkti",
      "Available rentals":"Galima išsinuomoti","Edit search":"Keisti paiešką","Add":"Į krepšelį","Details":"Informacija",
      "Available":"Laisva","Unavailable":"Neprieinama","Limited":"Ribotai","Fully booked":"Užimta","Check dates":"Patikrinti datas",
      "Continue to checkout":"Tęsti užsakymą","Back":"Atgal","Continue":"Tęsti","Close":"Uždaryti","Save":"Išsaugoti","Refresh":"Atnaujinti",
      "Pay now":"Mokėti dabar","Reserve & continue":"Rezervuoti ir tęsti","Secure payment":"Saugus apmokėjimas",
      "Pay securely":"Mokėti saugiai","Request received":"Užklausa gauta","Your rental request is in.":"Jūsų nuomos užklausa gauta.",
      "Request created":"Užklausa sukurta","Supplier confirmation":"Tiekėjo patvirtinimas","Pickup or delivery":"Atsiėmimas arba pristatymas",
      "Booking number":"Užsakymo numeris","View My Bookings":"Peržiūrėti užsakymus","Supplier account":"Tiekėjo paskyra",
      "Business, delivery & payouts":"Verslo duomenys, pristatymas ir išmokos","Business details":"Verslo duomenys","Company name":"Įmonės pavadinimas",
      "Contact person":"Kontaktinis asmuo","Phone":"Telefonas","Email":"El. paštas","Business address":"Įmonės adresas","Business type":"Veiklos tipas",
      "Delivery zones":"Pristatymo zonos","Payment information":"Mokėjimų informacija","Save profile":"Išsaugoti profilį","Order details":"Užsakymo informacija",
      "Availability":"Prieinamumas","Item availability":"Daikto prieinamumas","Inventory availability":"Inventoriaus prieinamumas",
      "Today":"Šiandien","Orders":"Užsakymai","Listings":"Skelbimai","Calendar":"Kalendorius","Earnings":"Pajamos","Account":"Paskyra",
      "Overview":"Apžvalga","Suppliers":"Tiekėjai","Money":"Finansai","Support":"Pagalba","Settings":"Nustatymai","Needs attention":"Reikia dėmesio",
      "Platform health":"Platformos būsena","Listing moderation":"Skelbimų moderavimas","Disputes":"Ginčai","Customer":"Klientas",
      "Track reservations, cancellation/refund status and completed rentals.":"Stebėkite rezervacijas, atšaukimus, grąžinimus ir užbaigtas nuomas.",
      "Load my bookings":"Įkelti mano užsakymus","Upcoming":"Artėjantys","Active":"Aktyvūs","Past":"Praėję","All":"Visi",
      "Explore":"Atrasti","Bookings":"Užsakymai","Rent smarter. Own less.":"Nuomokis protingiau. Turėk mažiau.",
      "No rentals found":"Nuomos pasiūlymų nerasta","Try a larger radius, different dates, or another category.":"Pabandykite didesnį atstumą, kitas datas arba kitą kategoriją.",
      "Reset filters":"Atstatyti filtrus","Welcome to RentAll":"Sveiki atvykę į RentAll","Rent what you need. Anywhere.":"Nuomokis tai, ko reikia. Bet kur.",
      "Personalize":"Pritaikykite","Set your language and currency":"Pasirinkite kalbą ir valiutą","Language":"Kalba","Currency":"Valiuta",
      "Ready":"Paruošta","Your marketplace is set up":"Viskas paruošta","Start exploring":"Pradėti naršyti",
      "Pending":"Laukiama","Verified":"Patvirtintas","Suspended":"Sustabdytas","Cancelled":"Atšauktas","Refunded":"Grąžinta","Failed":"Nepavyko",
      "Loading":"Kraunama","Added":"Pridėta","No bookings":"Užsakymų nėra","Booking confirmed":"Užsakymas patvirtintas","Payment successful":"Apmokėjimas sėkmingas",
      "Search":"Ieškoti","Sort":"Rūšiuoti","Map":"Žemėlapis","List":"Sąrašas"
    },
    en:{},
    es:{
      "Browse":"Explorar","How it works":"Cómo funciona","For partners":"Para proveedores","For suppliers":"Para proveedores","My bookings":"Mis reservas",
      "Supplier login":"Acceso proveedor","Notifications":"Notificaciones","Near me":"Cerca de mí","For my trip":"Para mi viaje","Country":"País","City":"Ciudad",
      "What do you need?":"¿Qué necesitas?","Category":"Categoría","Quantity":"Cantidad","From":"Desde","To":"Hasta","Search rentals":"Buscar alquileres",
      "Furniture":"Muebles","Tools & equipment":"Herramientas y equipo","Events & parties":"Eventos y fiestas","Electronics":"Electrónica",
      "Baby & family":"Bebé y familia","Sports & leisure":"Deporte y ocio","Other":"Otros","All categories":"Todas las categorías",
      "Available rentals":"Alquileres disponibles","Edit search":"Editar búsqueda","Add":"Añadir","Details":"Detalles","Available":"Disponible","Unavailable":"No disponible",
      "Continue":"Continuar","Back":"Atrás","Close":"Cerrar","Save":"Guardar","Refresh":"Actualizar","Pay now":"Pagar ahora","Secure payment":"Pago seguro",
      "Today":"Hoy","Orders":"Pedidos","Listings":"Anuncios","Calendar":"Calendario","Earnings":"Ingresos","Account":"Cuenta","Overview":"Resumen",
      "Suppliers":"Proveedores","Money":"Finanzas","Support":"Soporte","Settings":"Ajustes","Needs attention":"Requiere atención",
      "Customer":"Cliente","Upcoming":"Próximas","Active":"Activas","Past":"Pasadas","All":"Todas","Explore":"Explorar","Bookings":"Reservas",
      "No rentals found":"No se encontraron alquileres","Reset filters":"Restablecer filtros","Language":"Idioma","Currency":"Moneda",
      "Pending":"Pendiente","Verified":"Verificado","Suspended":"Suspendido","Cancelled":"Cancelado","Refunded":"Reembolsado","Failed":"Fallido",
      "Loading":"Cargando","Added":"Añadido","Booking confirmed":"Reserva confirmada","Payment successful":"Pago realizado",

    },
    de:{
      "Browse":"Entdecken","How it works":"So funktioniert es","For partners":"Für Anbieter","For suppliers":"Für Anbieter","My bookings":"Meine Buchungen",
      "Supplier login":"Anbieter-Login","Notifications":"Benachrichtigungen","Near me":"In meiner Nähe","For my trip":"Für meine Reise","Country":"Land","City":"Stadt",
      "What do you need?":"Was brauchst du?","Category":"Kategorie","Quantity":"Menge","From":"Von","To":"Bis","Search rentals":"Mietangebote suchen",
      "Furniture":"Möbel","Tools & equipment":"Werkzeuge & Geräte","Events & parties":"Events & Feiern","Electronics":"Elektronik","Baby & family":"Baby & Familie",
      "Sports & leisure":"Sport & Freizeit","Other":"Sonstiges","All categories":"Alle Kategorien","Available rentals":"Verfügbare Mietangebote",
      "Edit search":"Suche ändern","Add":"Hinzufügen","Details":"Details","Available":"Verfügbar","Unavailable":"Nicht verfügbar","Continue":"Weiter","Back":"Zurück",
      "Close":"Schließen","Save":"Speichern","Refresh":"Aktualisieren","Pay now":"Jetzt zahlen","Secure payment":"Sichere Zahlung",
      "Today":"Heute","Orders":"Bestellungen","Listings":"Anzeigen","Calendar":"Kalender","Earnings":"Einnahmen","Account":"Konto","Overview":"Übersicht",
      "Suppliers":"Anbieter","Money":"Finanzen","Support":"Support","Settings":"Einstellungen","Needs attention":"Handlungsbedarf",
      "Customer":"Kunde","Upcoming":"Bevorstehend","Active":"Aktiv","Past":"Vergangen","All":"Alle","Explore":"Entdecken","Bookings":"Buchungen",
      "No rentals found":"Keine Mietangebote gefunden","Reset filters":"Filter zurücksetzen","Language":"Sprache","Currency":"Währung",
      "Pending":"Ausstehend","Verified":"Verifiziert","Suspended":"Gesperrt","Cancelled":"Storniert","Refunded":"Erstattet","Failed":"Fehlgeschlagen",
      "Loading":"Lädt","Added":"Hinzugefügt","Booking confirmed":"Buchung bestätigt","Payment successful":"Zahlung erfolgreich",

    },
    ru:{
      "Browse":"Каталог","How it works":"Как это работает","For partners":"Поставщикам","For suppliers":"Поставщикам","My bookings":"Мои бронирования",
      "Supplier login":"Вход для поставщика","Notifications":"Уведомления","Near me":"Рядом со мной","For my trip":"Для поездки","Country":"Страна","City":"Город",
      "What do you need?":"Что вам нужно?","Category":"Категория","Quantity":"Количество","From":"С","To":"По","Search rentals":"Найти аренду",
      "Furniture":"Мебель","Tools & equipment":"Инструменты и оборудование","Events & parties":"Мероприятия и праздники","Electronics":"Электроника",
      "Baby & family":"Для детей и семьи","Sports & leisure":"Спорт и отдых","Other":"Другое","All categories":"Все категории","Available rentals":"Доступно для аренды",
      "Edit search":"Изменить поиск","Add":"Добавить","Details":"Подробнее","Available":"Доступно","Unavailable":"Недоступно","Continue":"Продолжить","Back":"Назад",
      "Close":"Закрыть","Save":"Сохранить","Refresh":"Обновить","Pay now":"Оплатить","Secure payment":"Безопасная оплата",
      "Today":"Сегодня","Orders":"Заказы","Listings":"Объявления","Calendar":"Календарь","Earnings":"Доход","Account":"Аккаунт","Overview":"Обзор",
      "Suppliers":"Поставщики","Money":"Финансы","Support":"Поддержка","Settings":"Настройки","Needs attention":"Требует внимания",
      "Customer":"Клиент","Upcoming":"Предстоящие","Active":"Активные","Past":"Прошедшие","All":"Все","Explore":"Каталог","Bookings":"Бронирования",
      "No rentals found":"Ничего не найдено","Reset filters":"Сбросить фильтры","Language":"Язык","Currency":"Валюта",
      "Pending":"Ожидает","Verified":"Проверен","Suspended":"Приостановлен","Cancelled":"Отменен","Refunded":"Возвращено","Failed":"Ошибка",
      "Loading":"Загрузка","Added":"Добавлено","Booking confirmed":"Бронирование подтверждено","Payment successful":"Оплата успешна",

    }
  };

  dictionaries.en = new Proxy({}, {get:(_,key)=>String(key)});
  const lt=dictionaries.lt;
  const meta={
    lt:{title:'RentAll — daiktų nuoma netoliese',desc:'Nuomokitės daiktus iš žmonių ir verslų netoliese. Ieškokite pagal vietą, kategoriją, kiekį ir datas.'},
    en:{title:'RentAll — Local Item Rentals',desc:'Rent items from people and businesses nearby. Search by location, category, quantity and dates.'},
    es:{title:'RentAll — Alquiler de artículos cerca de ti',desc:'Alquila artículos de personas y empresas cercanas. Busca por ubicación, categoría, cantidad y fechas.'},
    de:{title:'RentAll — Mietartikel in deiner Nähe',desc:'Miete Artikel von Menschen und Unternehmen in deiner Nähe. Suche nach Ort, Kategorie, Menge und Datum.'},
    ru:{title:'RentAll — аренда вещей рядом',desc:'Арендуйте вещи у людей и компаний рядом. Ищите по месту, категории, количеству и датам.'}
  };
  const originalText=new WeakMap();
  const originalAttrs=new WeakMap();
  const skipTags=new Set(['SCRIPT','STYLE','NOSCRIPT','TEXTAREA']);

  function browserLocale(){
    const raw=(navigator.language||'').toLowerCase().split('-')[0];
    return SUPPORTED.includes(raw)?raw:'lt';
  }
  function current(){
    try{
      const saved=localStorage.getItem('rentall_language');
      if(SUPPORTED.includes(saved)) return saved;
    }catch{}
    return browserLocale();
  }
  function lookup(text,lang){
    const clean=String(text||'').trim();
    if(!clean) return clean;
    if(lang==='en') return clean;
    return dictionaries[lang]?.[clean] || lt[clean] && lang==='lt' ? (dictionaries[lang]?.[clean]||lt[clean]) : null;
  }
  function translateTextNode(node,lang){
    if(!node || !node.parentElement || skipTags.has(node.parentElement.tagName)) return;
    if(!originalText.has(node)) originalText.set(node,node.nodeValue);
    const original=originalText.get(node);
    const trimmed=original.trim();
    if(!trimmed) return;
    const translated=lookup(trimmed,lang);
    if(translated){
      const lead=original.match(/^\s*/)?.[0]||'';
      const trail=original.match(/\s*$/)?.[0]||'';
      node.nodeValue=lead+translated+trail;
    }else if(lang==='en'){
      node.nodeValue=original;
    }
  }
  function translateAttrs(el,lang){
    const attrs=['placeholder','aria-label','title'];
    if(!originalAttrs.has(el)) originalAttrs.set(el,{});
    const bag=originalAttrs.get(el);
    for(const attr of attrs){
      if(el.hasAttribute(attr) && bag[attr]===undefined) bag[attr]=el.getAttribute(attr);
      const original=bag[attr];
      if(!original) continue;
      const translated=lookup(original,lang);
      el.setAttribute(attr, translated || (lang==='en'?original:el.getAttribute(attr)));
    }
  }
  function translateTree(root,lang){
    if(!root) return;
    if(root.nodeType===3){translateTextNode(root,lang);return;}
    if(root.nodeType!==1 && root.nodeType!==9 && root.nodeType!==11) return;
    if(root.nodeType===1) translateAttrs(root,lang);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
    let n;
    while((n=walker.nextNode())){
      if(n.nodeType===3) translateTextNode(n,lang);
      else translateAttrs(n,lang);
    }
  }
  function populateSelector(){
    const sel=document.getElementById('lang');
    if(!sel) return;
    const labels={lt:'LT',en:'EN',es:'ES',de:'DE',ru:'RU'};
    sel.innerHTML=SUPPORTED.map(x=>`<option value="${x}">${labels[x]}</option>`).join('');
    sel.value=current();
  }
  function updateMeta(lang){
    document.documentElement.lang=lang;
    document.title=meta[lang]?.title||meta.en.title;
    const desc=document.querySelector('meta[name="description"]');
    if(desc) desc.setAttribute('content',meta[lang]?.desc||meta.en.desc);
  }
  function apply(lang){
    if(!SUPPORTED.includes(lang)) lang='lt';
    try{localStorage.setItem('rentall_language',lang)}catch{}
    updateMeta(lang);
    translateTree(document.body,lang);
    const sel=document.getElementById('lang'); if(sel && sel.value!==lang) sel.value=lang;
    document.dispatchEvent(new CustomEvent('rentall:language-changed',{detail:{lang}}));
  }
  function t(key,vars){
    const lang=current();
    let out=dictionaries[lang]?.[key] || (lang==='en'?key:null) || dictionaries.lt[key] || key;
    if(vars) for(const [k,v] of Object.entries(vars)) out=out.replaceAll(`{${k}}`,String(v));
    return out;
  }
  window.RentAllI18n={t,apply,getLanguage:current,supported:SUPPORTED,dictionaries};

  function init(){
    populateSelector();
    const sel=document.getElementById('lang');
    if(sel){
      const clone=sel.cloneNode(true);
      sel.replaceWith(clone);
      clone.addEventListener('change',e=>apply(e.target.value));
    }
    apply(current());
    const observer=new MutationObserver(records=>{
      const lang=current();
      for(const r of records){
        r.addedNodes.forEach(n=>translateTree(n,lang));
      }
    });
    observer.observe(document.body,{subtree:true,childList:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
