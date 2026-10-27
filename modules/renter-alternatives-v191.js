(function(){
  const COPY={
    lt:{declinedTitle:'Šis užsakymas nebuvo patvirtintas',declinedLead:'Tiekėjas negalėjo patvirtinti pasirinktos nuomos. Radome panašių variantų, kurie gali tikti toms pačioms datoms.',autoTitle:'Tiekėjas laiku neatsakė',autoLead:'Kad nereikėtų laukti ilgiau, užsakymą automatiškai atšaukėme. Radome kitų panašių variantų toms pačioms datoms.',similar:'Panašūs variantai',available:'Prieinama toms pačioms datoms',price:'/ d.',respond:'Tiekėjas turi atsakyti per {hours} aktyv. val.',send:'Siųsti užsakymo prašymą toms pačioms datoms',details:'Peržiūrėti informaciją',more:'Rodyti daugiau panašių variantų',review:'Prieš siunčiant galėsite peržiūrėti naują užsakymą. Rezervacija patvirtinama tik tiekėjui ją patvirtinus.',none:'Šiuo metu neradome tinkamos alternatyvos toms pačioms datoms.',qty:'Liko {qty} vnt.'},
    en:{declinedTitle:'This booking was not confirmed',declinedLead:'The supplier could not confirm your selected rental. We found similar options that may work for the same dates.',autoTitle:'The supplier did not respond in time',autoLead:'To avoid keeping you waiting, we cancelled the request automatically and found other similar options for the same dates.',similar:'Similar options',available:'Available for the same dates',price:'/ day',respond:'Supplier must respond within {hours} active hours',send:'Send a booking request for the same dates',details:'View details',more:'Show more similar options',review:'You can review the new request before sending it. The rental is confirmed only after the supplier approves it.',none:'We could not find a suitable alternative for the same dates right now.',qty:'{qty} left'},
    es:{declinedTitle:'Esta reserva no fue confirmada',declinedLead:'El proveedor no pudo confirmar el alquiler elegido. Encontramos opciones similares para las mismas fechas.',autoTitle:'El proveedor no respondió a tiempo',autoLead:'Para no hacerte esperar más, cancelamos la solicitud automáticamente y encontramos opciones similares para las mismas fechas.',similar:'Opciones similares',available:'Disponible para las mismas fechas',price:'/ día',respond:'El proveedor debe responder en {hours} horas activas',send:'Enviar solicitud para las mismas fechas',details:'Ver detalles',more:'Ver más opciones similares',review:'Podrás revisar la nueva solicitud antes de enviarla. La reserva solo queda confirmada cuando el proveedor la aprueba.',none:'Ahora mismo no encontramos una alternativa adecuada para las mismas fechas.',qty:'Quedan {qty}'},
    de:{declinedTitle:'Diese Buchung wurde nicht bestätigt',declinedLead:'Der Anbieter konnte die ausgewählte Miete nicht bestätigen. Wir haben ähnliche Optionen für dieselben Daten gefunden.',autoTitle:'Der Anbieter hat nicht rechtzeitig geantwortet',autoLead:'Damit du nicht länger warten musst, haben wir die Anfrage automatisch storniert und ähnliche Optionen für dieselben Daten gefunden.',similar:'Ähnliche Optionen',available:'Für dieselben Daten verfügbar',price:'/ Tag',respond:'Anbieter muss innerhalb von {hours} aktiven Stunden antworten',send:'Anfrage für dieselben Daten senden',details:'Details ansehen',more:'Mehr ähnliche Optionen',review:'Du kannst die neue Anfrage vor dem Senden prüfen. Die Miete ist erst bestätigt, wenn der Anbieter zustimmt.',none:'Für dieselben Daten wurde aktuell keine passende Alternative gefunden.',qty:'{qty} verfügbar'},
    ru:{declinedTitle:'Этот заказ не был подтверждён',declinedLead:'Поставщик не смог подтвердить выбранную аренду. Мы нашли похожие варианты на те же даты.',autoTitle:'Поставщик не ответил вовремя',autoLead:'Чтобы вы не ждали дольше, запрос был отменён автоматически. Мы нашли похожие варианты на те же даты.',similar:'Похожие варианты',available:'Доступно на те же даты',price:'/ день',respond:'Поставщик должен ответить в течение {hours} активных часов',send:'Отправить запрос на те же даты',details:'Подробнее',more:'Показать больше похожих вариантов',review:'Перед отправкой можно проверить новый заказ. Аренда подтверждается только после подтверждения поставщиком.',none:'Сейчас подходящих альтернатив на те же даты не найдено.',qty:'Осталось {qty} шт.'}
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const lang=()=>window.RentInOrbitI18n?.getLanguage?.()||document.documentElement.lang||'lt';
  const t=(key,vars={})=>{let x=(COPY[lang()]||COPY.en)[key]||key;for(const [k,v] of Object.entries(vars))x=x.replaceAll(`{${k}}`,String(v));return x};
  const accessToken=id=>{try{return typeof bookingAccessToken==='function'?bookingAccessToken(id):''}catch{return ''}};
  const state=b=>window.rentinorbitBookingStatus?.stateFor?.(b)||String(b?.status||'').toLowerCase();
  const eligible=b=>['declined','auto'].includes(state(b)) || String(b?.status||'').toLowerCase()==='expired';
  const euro=n=>`€${Number(n||0).toFixed(2)}`;
  const safeImage=v=>/^\/uploads\/[a-zA-Z0-9._-]+$/.test(String(v||''))?String(v):'';
  const fetchJson=async url=>{const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Unable to load alternatives');return data};
  async function fetchAlternatives(b){
    const token=accessToken(b.bookingId);const q=token?`?accessToken=${encodeURIComponent(token)}`:'';
    return fetchJson(`/api/customer/bookings/${encodeURIComponent(b.bookingId)}/alternatives${q}`);
  }
  function mergeListing(l){
    try{
      const items=typeof loadUniversalListings==='function'?loadUniversalListings():[];
      const idx=items.findIndex(x=>String(x.id)===String(l.id));
      if(idx>=0)items[idx]={...items[idx],...l};else items.unshift(l);
      localStorage.setItem('rentinorbit_listings',JSON.stringify(items));
    }catch{}
  }
  function setField(id,value){const el=document.getElementById(id);if(!el||value==null||value==='')return;el.value=String(value);el.dispatchEvent(new Event('change',{bubbles:true}))}
  function prepareContext(l,ctx){
    mergeListing(l);
    ['fromDate','tripFromDate'].forEach(id=>setField(id,ctx.startDate));
    ['toDate','tripToDate'].forEach(id=>setField(id,ctx.endDate));
    ['quantitySearch','tripQuantity'].forEach(id=>setField(id,ctx.quantity||1));
    if(ctx.country)setField('countrySelect',ctx.country);
    if(ctx.city){
      try{if(typeof populateUniversalCities==='function')populateUniversalCities()}catch{}
      setField('citySelect',ctx.city);
    }
    try{localStorage.setItem('rentinorbit_alternative_context',JSON.stringify({listingId:l.id,startDate:ctx.startDate,endDate:ctx.endDate,quantity:ctx.quantity||1,city:ctx.city||'',country:ctx.country||'',createdAt:new Date().toISOString()}))}catch{}
  }
  function openDetails(l,ctx){prepareContext(l,ctx);try{openListingDetail(l.id)}catch{document.querySelector('#browse')?.scrollIntoView({behavior:'smooth'})}}
  function continueSameDates(l,ctx){
    prepareContext(l,ctx);
    try{openListingDetail(l.id);setTimeout(()=>document.getElementById('detailRentBtn')?.focus(),60)}catch{document.querySelector('#browse')?.scrollIntoView({behavior:'smooth'})}
  }
  function browseMore(ctx){
    ['fromDate','tripFromDate'].forEach(id=>setField(id,ctx.startDate));['toDate','tripToDate'].forEach(id=>setField(id,ctx.endDate));['quantitySearch','tripQuantity'].forEach(id=>setField(id,ctx.quantity||1));
    if(ctx.country)setField('countrySelect',ctx.country);if(ctx.city){try{if(typeof populateUniversalCities==='function')populateUniversalCities()}catch{}setField('citySelect',ctx.city)}
    if(ctx.category)setField('categorySelect',ctx.category);
    try{if(typeof renderGeoAwareListings==='function')renderGeoAwareListings(loadUniversalListings())}catch{}
    document.getElementById('browse')?.scrollIntoView({behavior:'smooth'});
  }
  function card(l,ctx){
    const image=safeImage(l.coverPhoto);const fulfillment=[l.pickupEnabled!==false?'Pickup':null,l.deliveryEnabled?'Delivery':null].filter(Boolean).join(' · ');
    return `<article class="renter-alt-card" data-alt-id="${esc(l.id)}">${image?`<img src="${esc(image)}" alt="${esc(l.title)}">`:''}<div class="renter-alt-body"><small>${esc([l.city,l.country].filter(Boolean).join(', '))}</small><h4>${esc(l.title)}</h4><div class="renter-alt-meta"><span>📅 ${esc(t('available'))}</span><span>💶 ${esc(euro(l.priceDay))} ${esc(t('price'))}</span><span>⏱ ${esc(t('respond',{hours:l.supplierResponseHours||4}))}</span><span>✓ ${esc(t('qty',{qty:l.remainingQuantity||l.quantity||0}))}</span>${fulfillment?`<span>${esc(fulfillment)}</span>`:''}</div><div class="renter-alt-actions"><button type="button" class="primary" data-alt-send="${esc(l.id)}">${esc(t('send'))}</button><button type="button" class="secondary" data-alt-details="${esc(l.id)}">${esc(t('details'))}</button></div></div></article>`;
  }
  function renderShell(b,data){
    const auto=Boolean(b?.supplierAutoDeclinedAt)||state(b)==='auto';const alts=Array.isArray(data.alternatives)?data.alternatives:[];const ctx=data.context||{startDate:b.startDate,endDate:b.endDate,quantity:b.quantity||1};
    const title=auto?t('autoTitle'):t('declinedTitle'),lead=auto?t('autoLead'):t('declinedLead');
    return `<section class="renter-alternatives" aria-label="${esc(t('similar'))}"><div class="renter-alt-head"><div><span class="eyebrow">RentInOrbit</span><h3>${esc(title)}</h3><p>${esc(lead)}</p></div></div><div class="renter-alt-section-title">${esc(t('similar'))}</div>${alts.length?`<div class="renter-alt-grid">${alts.map(x=>card(x,ctx)).join('')}</div><p class="renter-alt-note">${esc(t('review'))}</p><button type="button" class="secondary renter-alt-more">${esc(t('more'))}</button>`:`<p class="renter-alt-empty">${esc(t('none'))}</p><button type="button" class="secondary renter-alt-more">${esc(t('more'))}</button>`}</section>`;
  }
  function wire(el,b,data){
    const byId=id=>(data.alternatives||[]).find(x=>String(x.id)===String(id));const ctx=data.context||{startDate:b.startDate,endDate:b.endDate,quantity:b.quantity||1};
    el.querySelectorAll('[data-alt-details]').forEach(btn=>btn.addEventListener('click',()=>{const l=byId(btn.dataset.altDetails);if(l)openDetails(l,ctx)}));
    el.querySelectorAll('[data-alt-send]').forEach(btn=>btn.addEventListener('click',()=>{const l=byId(btn.dataset.altSend);if(l)continueSameDates(l,ctx)}));
    el.querySelector('.renter-alt-more')?.addEventListener('click',()=>browseMore(ctx));
  }
  async function mount(target,b){
    const el=typeof target==='string'?document.getElementById(target):target;if(!el)return;if(!eligible(b)){el.innerHTML='';el.hidden=true;return}el.hidden=false;el.innerHTML='<div class="renter-alt-loading">…</div>';
    try{const data=await fetchAlternatives(b);el.innerHTML=renderShell(b,data);wire(el,b,data)}catch{el.innerHTML=`<section class="renter-alternatives"><p class="renter-alt-empty">${esc(t('none'))}</p></section>`}
  }
  async function hydrate(root,bookings=[]){
    for(const b of bookings){const slot=root?.querySelector?.(`[data-booking-alternatives="${CSS.escape(String(b.bookingId))}"]`);if(slot)await mount(slot,b)}
  }
  window.rentinorbitAlternatives={mount,hydrate,eligible};
  document.addEventListener('rentinorbit:language-changed',()=>{if(window.__rentinorbitLatestBooking?.booking)mount('v191LiveAlternatives',window.__rentinorbitLatestBooking.booking)});
})();
