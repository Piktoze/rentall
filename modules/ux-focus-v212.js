// Minimal customer/supplier UX: state-driven controls; no server-side access changes.
(function(){
  const dictionary={
    lt:{personal:'Tapatybės patvirtinimas',business:'Verslo patvirtinimas',shortcut:'Valdyk skelbimus ir užsakymus vienoje vietoje.',create:'Įkelti skelbimą'},
    en:{personal:'Identity verification',business:'Business verification',shortcut:'Manage your listings and bookings in one place.',create:'Create a listing'},
    es:{personal:'Verificación de identidad',business:'Verificación de empresa',shortcut:'Gestiona tus anuncios y reservas en un solo lugar.',create:'Publicar un anuncio'},
    de:{personal:'Identitätsprüfung',business:'Unternehmensverifizierung',shortcut:'Verwalte Angebote und Buchungen an einem Ort.',create:'Inserat erstellen'},
    ru:{personal:'Проверка личности',business:'Проверка компании',shortcut:'Управляйте объявлениями и бронированиями в одном месте.',create:'Создать объявление'}
  };
  const lang=()=>window.RentInOrbitI18n?.getLanguage?.()||document.getElementById('lang')?.value||'lt';
  const copy=()=>dictionary[lang()]||dictionary.lt;
  function syncPartner(){
    const loggedIn=document.body.classList.contains('rio-authenticated');
    const lead=document.getElementById('partnerLead');
    const shortcut=document.getElementById('rioRegisteredSupplierShortcut');
    if(lead)lead.hidden=loggedIn;
    if(shortcut){
      shortcut.hidden=!loggedIn;
      const p=shortcut.querySelector('p');
      const a=shortcut.querySelector('a');
      if(p)p.textContent=copy().shortcut;
      if(a)a.textContent=copy().create;
    }
  }
  function syncVerification(){
    const select=document.getElementById('stripeLegalEntityType');
    const label=document.getElementById('rioStripeVerificationLabel');
    if(!select||!label)return;
    const isBusiness=select.value!=='individual';
    // Both roles need Stripe KYC; a private person never sees "business verification".
    label.textContent=isBusiness?copy().business:copy().personal;
    label.dataset.i18nText=isBusiness?'Business verification':'Identity verification';
  }
  function sync(){
    syncPartner();
    syncVerification();
  }
  document.addEventListener('rentinorbit:auth-ui-updated',syncPartner);
  document.addEventListener('rentinorbit:language-changed',()=>queueMicrotask(sync));
  document.getElementById('lang')?.addEventListener('change',()=>queueMicrotask(sync));
  document.getElementById('stripeLegalEntityType')?.addEventListener('change',syncVerification);
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href="#how"]');
    if(!link)return;
    const target=document.getElementById('how');
    if(!target)return;
    event.preventDefault();
    // A native anchor inside <details> may be affected by menu-closing handlers.
    const menu=link.closest('details');
    if(menu)menu.open=false;
    history.replaceState(history.state,'',location.pathname+location.search+'#how');
    target.scrollIntoView({behavior:'smooth',block:'start'});
  },true);
  document.addEventListener('click',event=>{
    if(event.target.closest('#supplierLogoutBtn'))setTimeout(syncPartner,200);
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});
  else sync();
})();