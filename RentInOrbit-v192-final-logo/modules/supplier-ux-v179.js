// RentInOrbit V179 — reliable modal portals, universal account mode and simplified supplier actions.
(function supplierUxV179(){
  const $=id=>document.getElementById(id);
  const safeJson=value=>{try{return JSON.parse(value||'null')}catch{return null}};
  const lang=()=>window.RentInOrbitI18n?.getLanguage?.()||document.documentElement.lang||'lt';
  const copy={
    lt:{account:'Paskyra',startSupplying:'Pradėti nuomoti',upgradeOk:'Tiekėjo funkcijos įjungtos tai pačiai paskyrai.',myBookings:'Mano užsakymai',noListings:'Kalendorius atsiras, kai įkelsi pirmą skelbimą.',addFirst:'+ Įkelti pirmą skelbimą',messages:'Žinutės',help:'Pagalba ir DUK',logout:'Atsijungti',close:'Uždaryti',calendar:'Kalendorius',item:'Skelbimas',from:'Nuo',to:'Iki',refresh:'Atnaujinti'},
    en:{account:'Account',startSupplying:'Start renting out',upgradeOk:'Supplier tools were enabled on the same account.',myBookings:'My bookings',noListings:'Your calendar will appear after you publish your first listing.',addFirst:'+ Add your first listing',messages:'Messages',help:'Help & FAQ',logout:'Log out',close:'Close',calendar:'Calendar',item:'Listing',from:'From',to:'To',refresh:'Refresh'},
    es:{account:'Cuenta',startSupplying:'Empezar a alquilar',upgradeOk:'Las herramientas de proveedor se activaron en la misma cuenta.',myBookings:'Mis reservas',noListings:'El calendario aparecerá cuando publiques tu primer anuncio.',addFirst:'+ Publicar primer anuncio',messages:'Mensajes',help:'Ayuda y FAQ',logout:'Cerrar sesión',close:'Cerrar',calendar:'Calendario',item:'Anuncio',from:'Desde',to:'Hasta',refresh:'Actualizar'},
    de:{account:'Konto',startSupplying:'Vermieten starten',upgradeOk:'Die Anbieterfunktionen wurden im selben Konto aktiviert.',myBookings:'Meine Buchungen',noListings:'Der Kalender erscheint, sobald du dein erstes Inserat veröffentlichst.',addFirst:'+ Erstes Inserat erstellen',messages:'Nachrichten',help:'Hilfe & FAQ',logout:'Abmelden',close:'Schließen',calendar:'Kalender',item:'Inserat',from:'Von',to:'Bis',refresh:'Aktualisieren'},
    ru:{account:'Аккаунт',startSupplying:'Начать сдавать',upgradeOk:'Функции поставщика включены в этом же аккаунте.',myBookings:'Мои бронирования',noListings:'Календарь появится после публикации первого объявления.',addFirst:'+ Добавить первое объявление',messages:'Сообщения',help:'Помощь и вопросы',logout:'Выйти',close:'Закрыть',calendar:'Календарь',item:'Объявление',from:'С',to:'По',refresh:'Обновить'}
  };
  const t=k=>(copy[lang()]||copy.lt)[k]||k;
  const user=()=>safeJson(localStorage.getItem('rentinorbit_server_user'));
  const isLogged=()=>!!user();
  const isSupplier=()=>['supplier','admin'].includes(user()?.role);

  async function call(url,options={}){
    if(typeof apiJson==='function')return apiJson(url,options);
    const r=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);
    return data;
  }
  function saveUser(next){
    if(!next)return;
    localStorage.setItem('rentinorbit_server_user',JSON.stringify(next));
    try{currentServerUser=next}catch{}
  }
  async function enableSupplierMode(){
    const current=user();
    if(!current){ $('supplierAuthBtn')?.click(); return null; }
    if(['supplier','admin'].includes(current.role))return current;
    const data=await call('/api/auth/enable-supplier',{method:'POST',body:'{}'});
    saveUser(data.user);
    if(typeof showToast==='function')showToast(t('upgradeOk'),'success',2400);
    return data.user;
  }

  function portalizeModals(){
    ['messagesModal','accountModal','authModal','listingModal','availabilityModal','listingDetailModal','agreementModal','renterReviewModal','reviewModal'].forEach(id=>{
      const modal=$(id);if(modal&&modal.parentElement!==document.body)document.body.appendChild(modal);
    });
  }
  function closeModal(modal){
    if(!modal)return;
    modal.classList.remove('open');modal.setAttribute('aria-hidden','true');
    if(!document.querySelector('.availability-modal.open,.account-modal.open,.auth-modal.open'))document.body.classList.remove('modal-open');
  }
  function strengthenModalExit(){
    document.addEventListener('click',e=>{
      const close=e.target.closest('.close-modal');
      if(close){const modal=close.closest('.availability-modal,.account-modal,.auth-modal,.listing-modal');if(modal){e.preventDefault();closeModal(modal);}}
      const modal=e.target.matches?.('.availability-modal,.account-modal,.auth-modal,.listing-modal')?e.target:null;
      if(modal)closeModal(modal);
    },true);
    document.addEventListener('keydown',e=>{
      if(e.key!=='Escape')return;
      document.querySelectorAll('.availability-modal.open,.account-modal.open,.auth-modal.open,.listing-modal.open').forEach(closeModal);
    });
  }

  function openMessages(){
    portalizeModals();
    if(window.RentInOrbitMessages?.open)return window.RentInOrbitMessages.open();
    const modal=$('messagesModal');if(modal){modal.classList.add('open');modal.setAttribute('aria-hidden','false');}
  }

  function supplierListings(){
    const u=user();
    if(!u||typeof loadUniversalListings!=='function')return [];
    return loadUniversalListings().filter(l=>String(l.ownerEmail||'').toLowerCase()===String(u.email||'').toLowerCase());
  }
  function prepareCalendar(){
    const section=$('supplierAvailabilitySection');if(!section)return;
    const listings=supplierListings();
    const select=$('supplierCalendarListing');
    if(select){
      if(!listings.length){select.innerHTML=`<option value="">${t('noListings')}</option>`;select.disabled=true;}
      else{
        const current=select.value;
        select.disabled=false;
        select.innerHTML=listings.map(l=>`<option value="${String(l.id).replaceAll('"','&quot;')}">${String(l.title||'').replaceAll('<','&lt;')}</option>`).join('');
        if(listings.some(l=>String(l.id)===String(current)))select.value=current;
      }
    }
    const grid=$('supplierCalendarGrid');
    if(!listings.length&&grid){
      grid.innerHTML=`<div class="supplier-calendar-empty"><p>${t('noListings')}</p><button type="button" class="primary" id="v179AddFromCalendar">${t('addFirst')}</button></div>`;
      $('v179AddFromCalendar')?.addEventListener('click',()=>openListing());
      const sum=$('supplierCalendarSummary');if(sum)sum.textContent='';
    }else{
      try{initSupplierAvailability()}catch{}
    }
  }
  async function openListing(){
    await enableSupplierMode();
    portalizeModals();
    $('openListingFormBtn')?.click();
  }
  function openCalendar(){
    const section=$('supplierAvailabilitySection');if(!section)return;
    document.body.classList.add('supplier-authenticated');
    section.classList.add('supplier-v178-external-visible','supplier-v179-calendar-open');
    prepareCalendar();
    setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'start'}),10);
  }

  function configureAccountDrawer(){
    const drawer=$('supplierActionDrawer');if(!drawer)return;
    const u=user();if(!u)return;
    const title=drawer.querySelector('#supplierDrawerTitle');
    if(u.role==='customer'){
      if(title)title.textContent=t('account');
      drawer.querySelectorAll('[data-supplier-action="listings"],[data-supplier-action="calendar"],[data-supplier-action="earnings"],[data-supplier-action="payouts"],[data-supplier-action="profile"]').forEach(x=>x.hidden=true);
      const add=drawer.querySelector('[data-supplier-action="add"]');if(add)add.textContent=t('startSupplying');
      const orders=drawer.querySelector('[data-supplier-action="orders"] span');if(orders)orders.textContent=t('myBookings');
    }else{
      drawer.querySelectorAll('[data-supplier-action]').forEach(x=>x.hidden=false);
    }
  }
  function openExistingDrawer(){
    const drawer=$('supplierActionDrawer');if(!drawer)return;
    configureAccountDrawer();
    drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');document.body.classList.add('supplier-drawer-open');
  }

  function bindAccountForAnyMember(){
    const btn=$('supplierAuthBtn');if(!btn||btn.dataset.v179Account)return;btn.dataset.v179Account='1';
    btn.addEventListener('click',e=>{
      if(!isLogged())return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();openExistingDrawer();
    },true);
  }
  function interceptDrawerActions(){
    const drawer=$('supplierActionDrawer');if(!drawer||drawer.dataset.v179Actions)return;drawer.dataset.v179Actions='1';
    drawer.addEventListener('click',async e=>{
      const action=e.target.closest('[data-supplier-action]')?.dataset.supplierAction;if(!action)return;
      if(action==='messages'){e.preventDefault();e.stopImmediatePropagation();drawer.classList.remove('open');openMessages();return;}
      if(action==='calendar'){e.preventDefault();e.stopImmediatePropagation();drawer.classList.remove('open');openCalendar();return;}
      if(action==='add'){e.preventDefault();e.stopImmediatePropagation();drawer.classList.remove('open');await openListing();return;}
      if(action==='orders'&&user()?.role==='customer'){e.preventDefault();e.stopImmediatePropagation();drawer.classList.remove('open');$('customerBookingsSection')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
    },true);
  }

  function interceptPartnerUpgrade(){
    const form=$('partnerLead');if(!form||form.dataset.v179Upgrade)return;form.dataset.v179Upgrade='1';
    form.addEventListener('submit',async e=>{
      const u=user();if(!u)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      try{await openListing();}catch(err){if(typeof showToast==='function')showToast(err.message,'error',2600);else alert(err.message);}
    },true);
  }

  function localizeCalendar(){
    const section=$('supplierAvailabilitySection');if(!section)return;
    const h=section.querySelector('h3');if(h)h.textContent=t('calendar');
    const labels=section.querySelectorAll('.supplier-calendar-controls label');
    if(labels[0]&&labels[0].firstChild)labels[0].firstChild.nodeValue=t('item')+' ';
    if(labels[1]&&labels[1].firstChild)labels[1].firstChild.nodeValue=t('from')+' ';
    if(labels[2]&&labels[2].firstChild)labels[2].firstChild.nodeValue=t('to')+' ';
    const refresh=$('refreshSupplierAvailabilityBtn');if(refresh)refresh.textContent=t('refresh');
  }

  function sync(){portalizeModals();bindAccountForAnyMember();interceptDrawerActions();interceptPartnerUpgrade();localizeCalendar();configureAccountDrawer();}
  document.addEventListener('rentinorbit:language-changed',()=>setTimeout(sync,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{sync();strengthenModalExit();},{once:true});else{sync();strengthenModalExit();}
})();
