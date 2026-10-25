// RentAll V178 — simplified supplier experience and right-side action drawer.
(function supplierUxV178(){
  const $=id=>document.getElementById(id);
  const safeJson=value=>{try{return JSON.parse(value||'null')}catch{return null}};
  const sourceText=new WeakMap();
  const lang=()=>window.RentAllI18n?.getLanguage?.()||document.documentElement.lang||'lt';
  const copy={
    lt:{center:'Tiekėjo centras',intro:'Valdyk nuomą paprastai. Pradėk nuo skelbimo, o kitus įrankius atverk tik tada, kai jų reikia.',add:'+ Įkelti skelbimą',menu:'Atidaryti tiekėjo meniu',drawer:'Tiekėjo meniu',listings:'Mano skelbimai',orders:'Užsakymai',calendar:'Kalendorius',messages:'Žinutės',earnings:'Pajamos',payouts:'Išmokos',profile:'Verslo profilis',help:'Pagalba ir DUK',logout:'Atsijungti',close:'Uždaryti',chooseConversation:'Pasirink pokalbį, kad galėtum rašyti.',send:'Siųsti',noConversation:'Pokalbių dar nėra. Atidaryk skelbimą ir pasirink „Parašyti tiekėjui“.',back:'Grįžti į tiekėjo centrą',featureListings:'Mano skelbimai',featureOrders:'Užsakymai',featureCalendar:'Kalendorius',featureEarnings:'Pajamos',featurePayouts:'Išmokos'},
    en:{center:'Supplier center',intro:'Manage rentals simply. Start by adding a listing, then open other tools only when you need them.',add:'+ Add listing',menu:'Open supplier menu',drawer:'Supplier menu',listings:'My listings',orders:'Orders',calendar:'Calendar',messages:'Messages',earnings:'Earnings',payouts:'Payouts',profile:'Business profile',help:'Help & FAQ',logout:'Log out',close:'Close',chooseConversation:'Choose a conversation to start writing.',send:'Send',noConversation:'No conversations yet. Open a listing and choose “Message supplier”.',back:'Back to supplier center',featureListings:'My listings',featureOrders:'Orders',featureCalendar:'Calendar',featureEarnings:'Earnings',featurePayouts:'Payouts'},
    es:{center:'Centro de proveedor',intro:'Gestiona los alquileres de forma sencilla. Empieza publicando un anuncio y abre las demás herramientas solo cuando las necesites.',add:'+ Publicar anuncio',menu:'Abrir menú de proveedor',drawer:'Menú de proveedor',listings:'Mis anuncios',orders:'Reservas',calendar:'Calendario',messages:'Mensajes',earnings:'Ingresos',payouts:'Pagos',profile:'Perfil del negocio',help:'Ayuda y FAQ',logout:'Cerrar sesión',close:'Cerrar',chooseConversation:'Elige una conversación para escribir.',send:'Enviar',noConversation:'Aún no hay conversaciones. Abre un anuncio y elige «Escribir al proveedor».',back:'Volver al centro de proveedor',featureListings:'Mis anuncios',featureOrders:'Reservas',featureCalendar:'Calendario',featureEarnings:'Ingresos',featurePayouts:'Pagos'},
    de:{center:'Anbieterbereich',intro:'Verwalte Vermietungen einfach. Erstelle zuerst ein Inserat und öffne weitere Werkzeuge nur bei Bedarf.',add:'+ Inserat erstellen',menu:'Anbietermenü öffnen',drawer:'Anbietermenü',listings:'Meine Inserate',orders:'Buchungen',calendar:'Kalender',messages:'Nachrichten',earnings:'Einnahmen',payouts:'Auszahlungen',profile:'Unternehmensprofil',help:'Hilfe & FAQ',logout:'Abmelden',close:'Schließen',chooseConversation:'Wähle eine Unterhaltung, um zu schreiben.',send:'Senden',noConversation:'Noch keine Unterhaltungen. Öffne ein Inserat und wähle „Anbieter kontaktieren“.',back:'Zurück zum Anbieterbereich',featureListings:'Meine Inserate',featureOrders:'Buchungen',featureCalendar:'Kalender',featureEarnings:'Einnahmen',featurePayouts:'Auszahlungen'},
    ru:{center:'Центр поставщика',intro:'Управляйте арендой проще. Сначала добавьте объявление, а остальные инструменты открывайте только при необходимости.',add:'+ Добавить объявление',menu:'Открыть меню поставщика',drawer:'Меню поставщика',listings:'Мои объявления',orders:'Заказы',calendar:'Календарь',messages:'Сообщения',earnings:'Доходы',payouts:'Выплаты',profile:'Профиль бизнеса',help:'Помощь и вопросы',logout:'Выйти',close:'Закрыть',chooseConversation:'Выберите диалог, чтобы начать писать.',send:'Отправить',noConversation:'Диалогов пока нет. Откройте объявление и выберите «Написать поставщику».',back:'Вернуться в центр поставщика',featureListings:'Мои объявления',featureOrders:'Заказы',featureCalendar:'Календарь',featureEarnings:'Доходы',featurePayouts:'Выплаты'}
  };
  const t=key=>(copy[lang()]||copy.lt)[key]||key;
  const getCachedUser=()=>safeJson(localStorage.getItem('rentall_server_user'));
  const isSupplier=()=>{
    const u=getCachedUser();
    return !!u && ['supplier','admin'].includes(u.role);
  };

  function createDrawer(){
    if($('supplierActionDrawer')) return;
    const wrap=document.createElement('div');
    wrap.id='supplierActionDrawer';
    wrap.className='supplier-action-drawer';
    wrap.setAttribute('aria-hidden','true');
    wrap.innerHTML=`<div class="supplier-drawer-backdrop" data-supplier-drawer-close></div><aside class="supplier-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="supplierDrawerTitle"><div class="supplier-drawer-head"><div><small>RentAll</small><h2 id="supplierDrawerTitle"></h2></div><button type="button" class="supplier-drawer-close" data-supplier-drawer-close aria-label="Close">×</button></div><button class="supplier-drawer-primary" type="button" data-supplier-action="add"></button><nav class="supplier-drawer-nav"><button type="button" data-supplier-action="listings">▦ <span></span></button><button type="button" data-supplier-action="orders">✓ <span></span></button><button type="button" data-supplier-action="calendar">□ <span></span></button><button type="button" data-supplier-action="messages">✉ <span></span></button><button type="button" data-supplier-action="earnings">€ <span></span></button><button type="button" data-supplier-action="payouts">↗ <span></span></button><button type="button" data-supplier-action="profile">○ <span></span></button><button type="button" data-supplier-action="help">? <span></span></button></nav><button class="supplier-drawer-logout" type="button" data-supplier-action="logout"></button></aside>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{
      if(e.target.closest('[data-supplier-drawer-close]')) closeDrawer();
      const action=e.target.closest('[data-supplier-action]')?.dataset.supplierAction;
      if(action) handleAction(action);
    });
    localizeDrawer();
  }
  function localizeDrawer(){
    const drawer=$('supplierActionDrawer'); if(!drawer)return;
    drawer.querySelector('#supplierDrawerTitle').textContent=t('drawer');
    drawer.querySelector('[data-supplier-action="add"]').textContent=t('add');
    ['listings','orders','calendar','messages','earnings','payouts','profile','help'].forEach(key=>{const el=drawer.querySelector(`[data-supplier-action="${key}"] span`);if(el)el.textContent=t(key);});
    drawer.querySelector('[data-supplier-action="logout"]').textContent=t('logout');
    drawer.querySelector('[data-supplier-drawer-close]').setAttribute('aria-label',t('close'));
  }
  function openDrawer(){
    createDrawer();
    const drawer=$('supplierActionDrawer');
    drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('supplier-drawer-open');
  }
  function closeDrawer(){const drawer=$('supplierActionDrawer');if(!drawer)return;drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');document.body.classList.remove('supplier-drawer-open');}

  function createHub(){
    const container=document.querySelector('#supplier-dashboard>.container');
    if(!container||$('supplierSimpleHub'))return;
    const hub=document.createElement('section');hub.id='supplierSimpleHub';hub.className='supplier-simple-hub';
    hub.innerHTML=`<div class="supplier-simple-copy"><div class="eyebrow">RentAll</div><h2></h2><p></p></div><div class="supplier-simple-actions"><button type="button" class="supplier-upload-hero" data-v178-hub="add"><span>+</span><b></b><small></small></button><button type="button" class="secondary supplier-menu-button" data-v178-hub="menu">☰ <span></span></button></div><div id="supplierFeatureTitle" class="supplier-feature-title" hidden><button class="secondary" type="button" data-v178-hub="back">← <span></span></button><h3></h3></div>`;
    container.prepend(hub);
    hub.addEventListener('click',e=>{const action=e.target.closest('[data-v178-hub]')?.dataset.v178Hub;if(action==='add')handleAction('add');if(action==='menu')openDrawer();if(action==='back')showSupplierHome();});
    localizeHub();
  }
  function localizeHub(){
    const hub=$('supplierSimpleHub');if(!hub)return;
    hub.querySelector('h2').textContent=t('center');hub.querySelector('.supplier-simple-copy p').textContent=t('intro');
    hub.querySelector('.supplier-upload-hero b').textContent=t('add').replace(/^\+\s*/, '');
    hub.querySelector('.supplier-upload-hero small').textContent=t('intro');
    hub.querySelector('.supplier-menu-button span').textContent=t('menu');
    hub.querySelector('[data-v178-hub="back"] span').textContent=t('back');
  }

  function dashboardDirectChildFor(node){
    const container=document.querySelector('#supplier-dashboard>.container');if(!container||!node)return null;
    let cur=node;while(cur&&cur.parentElement!==container)cur=cur.parentElement;return cur?.parentElement===container?cur:null;
  }
  function clearFeature(){
    const container=document.querySelector('#supplier-dashboard>.container');if(!container)return;
    $('supplierAvailabilitySection')?.classList.remove('supplier-v178-external-visible');
    container.querySelectorAll('.supplier-v178-visible').forEach(x=>x.classList.remove('supplier-v178-visible'));
    container.querySelectorAll('.supplier-v178-panel-active').forEach(x=>x.classList.remove('supplier-v178-panel-active'));
    document.body.classList.remove('supplier-v178-feature-mode');
    const ft=$('supplierFeatureTitle');if(ft){ft.hidden=true;ft.querySelector('h3').textContent='';}
  }
  function showSupplierHome(){clearFeature();$('supplierSimpleHub')?.scrollIntoView({behavior:'smooth',block:'start'});}
  function showFeature(targetId,titleKey){
    const dashboard=$('supplier-dashboard');if(!dashboard)return;
    dashboard.classList.add('unlocked');document.body.classList.add('supplier-authenticated','supplier-v178-feature-mode');
    const node=$(targetId);if(!node)return;
    const direct=dashboardDirectChildFor(node);if(direct)direct.classList.add('supplier-v178-visible');
    const panel=node.closest('.dashboard-panel');if(panel)panel.classList.add('supplier-v178-panel-active');
    if(node.id==='supplierPaymentsPanel')node.classList.add('open');
    const ft=$('supplierFeatureTitle');if(ft){ft.hidden=false;ft.querySelector('h3').textContent=t(titleKey);}
    setTimeout(()=>{(panel||node).scrollIntoView({behavior:'smooth',block:'start'});},20);
  }
  function handleAction(action){
    closeDrawer();
    if(action==='add'){ $('openListingFormBtn')?.click(); return; }
    if(action==='listings'){showFeature('v94InventoryBody','featureListings');return;}
    if(action==='orders'){showFeature('bookingTableBody','featureOrders');return;}
    if(action==='calendar'){$('supplierAvailabilitySection')?.classList.add('supplier-v178-external-visible');$('supplierAvailabilitySection')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    if(action==='messages'){$('messagesBtn')?.click();return;}
    if(action==='earnings'){showFeature('supplierFinanceOverview','featureEarnings');return;}
    if(action==='payouts'){showFeature('supplierPaymentsPanel','featurePayouts');try{$('supplierPaymentsBtn')?.click();}catch{}return;}
    if(action==='profile'){ $('supplierAccountBtn')?.click();return; }
    if(action==='help'){ location.href=`/help?lang=${encodeURIComponent(lang())}`;return; }
    if(action==='logout'){ if(typeof serverLogout==='function'){serverLogout();location.hash='home';setTimeout(()=>location.reload(),100);} return; }
  }

  function interceptAccountButton(){
    const btn=$('supplierAuthBtn');if(!btn||btn.dataset.v178Bound)return;btn.dataset.v178Bound='1';
    btn.addEventListener('click',e=>{
      if(!isSupplier())return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openDrawer();
    },true);
  }

  function upgradeModalBehavior(){
    document.querySelectorAll('.availability-modal,.account-modal,.auth-modal').forEach(modal=>{
      if(modal.dataset.v178Modal)return;modal.dataset.v178Modal='1';
      modal.addEventListener('click',e=>{if(e.target===modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}});
    });
    document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;closeDrawer();document.querySelectorAll('.availability-modal.open,.account-modal.open,.auth-modal.open').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true');});});
  }

  function improveMessages(){
    const modal=$('messagesModal'),form=$('messageForm'),body=$('messageBody');if(!modal||!form||!body)return;
    const send=form.querySelector('button[type="submit"]');
    const setWaiting=()=>{if(!modal.classList.contains('open'))return;if(!modal.querySelector('.conversation-row.active')){form.hidden=false;body.disabled=true;if(send)send.disabled=true;body.placeholder=t('chooseConversation');}};
    $('messagesBtn')?.addEventListener('click',()=>setTimeout(setWaiting,80));
    modal.addEventListener('click',e=>{if(e.target.closest('.conversation-row'))setTimeout(()=>{body.disabled=false;if(send)send.disabled=false;body.placeholder=window.RentAllI18n?.t?.('Write a message…')||'Write a message…';},80);});
    const observer=new MutationObserver(()=>setWaiting());observer.observe(modal,{attributes:true,subtree:true,childList:true});
  }

  const extra={
    lt:{
      'Supplier account':'Tiekėjo paskyra','Business, delivery & payouts':'Verslo profilis, pristatymas ir išmokos','Keep your company, delivery and payment information up to date.':'Atnaujink įmonės, pristatymo ir mokėjimo informaciją.','Business details':'Verslo duomenys','Company name':'Įmonės pavadinimas','Contact person':'Kontaktinis asmuo','Business address':'Įmonės adresas','Business type':'Veiklos tipas','Website / Instagram':'Svetainė / Instagram','Select the areas where you can deliver rental equipment.':'Pasirink vietoves, į kurias gali pristatyti nuomojamus daiktus.','Payment information':'Mokėjimo informacija','Payout details are managed through the secure payment connection for your supplier account.':'Išmokų duomenys valdomi per saugų mokėjimų ryšį tiekėjo paskyroje.','Account holder name':'Sąskaitos savininkas','Bank / payout country':'Banko / išmokų šalis','Payout schedule':'Išmokų dažnis','Save profile':'Išsaugoti profilį','Payments':'Mokėjimai','Manage payout setup, bank status and payment history.':'Valdyk išmokų nustatymus, banko būseną ir mokėjimų istoriją.','Bank account':'Banko sąskaita','Estimated next payout':'Numatoma kita išmoka','How often should we send your payouts?':'Kaip dažnai siųsti išmokas?','Open Stripe Dashboard':'Atidaryti Stripe valdymą','Refresh Stripe status':'Atnaujinti Stripe būseną','Payout status unavailable':'Išmokų būsena nepasiekiama','Refresh after signing in as a supplier.':'Atnaujink prisijungęs kaip tiekėjas.','No bookings yet':'Užsakymų dar nėra','Bookings made with this account will appear here.':'Šios paskyros užsakymai bus rodomi čia.','Filter and manage reservation requests.':'Filtruok ir valdyk rezervacijos užklausas.','Clear filters':'Išvalyti filtrus','Inventory & pricing':'Skelbimai ir kainos','Manage stock, daily rates and deposits from one operational view.':'Valdyk kiekį, dienos kainas ir užstatus vienoje vietoje.','Total units':'Bendras kiekis','Avg. daily rate':'Vidutinė dienos kaina','Inventory value / day':'Inventoriaus vertė per dieną'
    },
    en:{},
    es:{
      'Supplier account':'Cuenta de proveedor','Business, delivery & payouts':'Perfil del negocio, entrega y pagos','Keep your company, delivery and payment information up to date.':'Mantén actualizados los datos de empresa, entrega y pagos.','Business details':'Datos del negocio','Company name':'Nombre de la empresa','Contact person':'Persona de contacto','Business address':'Dirección de la empresa','Business type':'Tipo de actividad','Website / Instagram':'Web / Instagram','Select the areas where you can deliver rental equipment.':'Selecciona las zonas donde puedes entregar los artículos alquilados.','Payment information':'Información de pagos','Payout details are managed through the secure payment connection for your supplier account.':'Los datos de pago se gestionan mediante la conexión segura de pagos de tu cuenta de proveedor.','Account holder name':'Titular de la cuenta','Bank / payout country':'País del banco / pago','Payout schedule':'Frecuencia de pagos','Save profile':'Guardar perfil','Payments':'Pagos','Manage payout setup, bank status and payment history.':'Gestiona la configuración de pagos, el estado bancario y el historial de pagos.','Bank account':'Cuenta bancaria','Estimated next payout':'Próximo pago estimado','How often should we send your payouts?':'¿Con qué frecuencia debemos enviar los pagos?','Open Stripe Dashboard':'Abrir panel de Stripe','Refresh Stripe status':'Actualizar estado de Stripe','Payout status unavailable':'Estado de pago no disponible','Refresh after signing in as a supplier.':'Actualiza después de iniciar sesión como proveedor.','No bookings yet':'Todavía no hay reservas','Bookings made with this account will appear here.':'Las reservas de esta cuenta aparecerán aquí.','Filter and manage reservation requests.':'Filtra y gestiona las solicitudes de reserva.','Clear filters':'Borrar filtros','Inventory & pricing':'Anuncios y precios','Manage stock, daily rates and deposits from one operational view.':'Gestiona existencias, precios diarios y depósitos en un solo lugar.','Total units':'Unidades totales','Avg. daily rate':'Precio diario medio','Inventory value / day':'Valor del inventario por día'
    },
    de:{
      'Supplier account':'Anbieterkonto','Business, delivery & payouts':'Unternehmensprofil, Lieferung und Auszahlungen','Keep your company, delivery and payment information up to date.':'Halte Unternehmens-, Liefer- und Zahlungsdaten aktuell.','Business details':'Unternehmensdaten','Company name':'Firmenname','Contact person':'Kontaktperson','Business address':'Firmenadresse','Business type':'Unternehmensart','Website / Instagram':'Website / Instagram','Select the areas where you can deliver rental equipment.':'Wähle die Gebiete, in die du Mietartikel liefern kannst.','Payment information':'Zahlungsinformationen','Payout details are managed through the secure payment connection for your supplier account.':'Auszahlungsdaten werden über die sichere Zahlungsverbindung deines Anbieterkontos verwaltet.','Account holder name':'Kontoinhaber','Bank / payout country':'Bank-/Auszahlungsland','Payout schedule':'Auszahlungsrhythmus','Save profile':'Profil speichern','Payments':'Zahlungen','Manage payout setup, bank status and payment history.':'Verwalte Auszahlungseinstellungen, Bankstatus und Zahlungshistorie.','Bank account':'Bankkonto','Estimated next payout':'Voraussichtliche nächste Auszahlung','How often should we send your payouts?':'Wie oft sollen Auszahlungen gesendet werden?','Open Stripe Dashboard':'Stripe-Dashboard öffnen','Refresh Stripe status':'Stripe-Status aktualisieren','Payout status unavailable':'Auszahlungsstatus nicht verfügbar','Refresh after signing in as a supplier.':'Nach der Anmeldung als Anbieter aktualisieren.','No bookings yet':'Noch keine Buchungen','Bookings made with this account will appear here.':'Buchungen dieses Kontos erscheinen hier.','Filter and manage reservation requests.':'Buchungsanfragen filtern und verwalten.','Clear filters':'Filter löschen','Inventory & pricing':'Inserate und Preise','Manage stock, daily rates and deposits from one operational view.':'Bestand, Tagespreise und Kautionen an einem Ort verwalten.','Total units':'Gesamtmenge','Avg. daily rate':'Durchschn. Tagespreis','Inventory value / day':'Inventarwert pro Tag'
    },
    ru:{
      'Supplier account':'Аккаунт поставщика','Business, delivery & payouts':'Профиль бизнеса, доставка и выплаты','Keep your company, delivery and payment information up to date.':'Поддерживайте данные компании, доставки и выплат в актуальном состоянии.','Business details':'Данные бизнеса','Company name':'Название компании','Contact person':'Контактное лицо','Business address':'Адрес компании','Business type':'Тип деятельности','Website / Instagram':'Сайт / Instagram','Select the areas where you can deliver rental equipment.':'Выберите районы, куда вы можете доставлять вещи в аренду.','Payment information':'Платёжная информация','Payout details are managed through the secure payment connection for your supplier account.':'Данные выплат управляются через защищённое платёжное подключение аккаунта поставщика.','Account holder name':'Владелец счёта','Bank / payout country':'Страна банка / выплаты','Payout schedule':'График выплат','Save profile':'Сохранить профиль','Payments':'Платежи','Manage payout setup, bank status and payment history.':'Управляйте настройками выплат, статусом банка и историей платежей.','Bank account':'Банковский счёт','Estimated next payout':'Ожидаемая следующая выплата','How often should we send your payouts?':'Как часто отправлять выплаты?','Open Stripe Dashboard':'Открыть панель Stripe','Refresh Stripe status':'Обновить статус Stripe','Payout status unavailable':'Статус выплат недоступен','Refresh after signing in as a supplier.':'Обновите после входа как поставщик.','No bookings yet':'Заказов пока нет','Bookings made with this account will appear here.':'Заказы этого аккаунта появятся здесь.','Filter and manage reservation requests.':'Фильтруйте и управляйте запросами на бронирование.','Clear filters':'Сбросить фильтры','Inventory & pricing':'Объявления и цены','Manage stock, daily rates and deposits from one operational view.':'Управляйте количеством, дневными ценами и залогами в одном месте.','Total units':'Общее количество','Avg. daily rate':'Средняя цена за день','Inventory value / day':'Стоимость инвентаря в день'
    }
  };
  function localizeSupplierRoots(){
    const roots=['supplier-dashboard','accountModal','messagesModal','listingModal','supplierAvailabilitySection'].map($).filter(Boolean);
    const language=lang();
    roots.forEach(root=>{
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
      let node;while((node=walker.nextNode())){
        const current=node.nodeValue.trim();if(!current)continue;
        if(!sourceText.has(node))sourceText.set(node,current);
        const original=sourceText.get(node);
        let translated=window.RentAllI18n?.t?.(original)||original;
        if(extra[language]?.[original])translated=extra[language][original];
        const prefix=node.nodeValue.match(/^\s*/)?.[0]||'';
        const suffix=node.nodeValue.match(/\s*$/)?.[0]||'';
        node.nodeValue=prefix+translated+suffix;
      }
    });
  }

  function sync(){
    createDrawer();createHub();interceptAccountButton();upgradeModalBehavior();improveMessages();localizeDrawer();localizeHub();localizeSupplierRoots();
    document.body.classList.toggle('supplier-authenticated',isSupplier());
    const auth=$('supplierAuthBtn');if(auth&&isSupplier()){auth.setAttribute('aria-haspopup','dialog');auth.title=t('menu');auth.classList.add('supplier-account-trigger');}else if(auth){auth.classList.remove('supplier-account-trigger');}
  }
  document.addEventListener('rentall:language-changed',()=>setTimeout(()=>{localizeDrawer();localizeHub();localizeSupplierRoots();},0));
  const authObserver=new MutationObserver(()=>sync());const auth=$('supplierAuthBtn');if(auth)authObserver.observe(auth,{childList:true,subtree:true,characterData:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
})();
