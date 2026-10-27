(function(){
  const ACTIVE_START=8, ACTIVE_END=22;
  const COUNTRY_TZ={LT:'Europe/Vilnius',ES:'Europe/Madrid',PT:'Europe/Lisbon',GR:'Europe/Athens',CY:'Asia/Nicosia',IT:'Europe/Rome',FR:'Europe/Paris',DE:'Europe/Berlin'};
  const LOCALE={lt:'lt-LT',en:'en-GB',es:'es-ES',de:'de-DE',ru:'ru-RU'};
  const COPY={
    lt:{
      title:'Kada nuomotojas patvirtins?',
      request:'Šiam skelbimui nuomotojas turi {hours} aktyvias valandas atsakyti. Aktyvios valandos skaičiuojamos 08:00–22:00 nuomotojo vietos laiku; naktį laikmatis sustoja.',
      deadline:'Tiekėjas turi atsakyti iki {when}.',
      deadlineLocal:'Tiekėjas turi atsakyti iki {when} (jo vietos laiku).',
      noReply:'Jei atsakymo iki termino nėra, užsakymas automatiškai atšaukiamas. Jei mokėjimas buvo rezervuotas ar atliktas, jis atšaukiamas arba grąžinamas pagal mokėjimo būseną.',
      instant:'Šis skelbimas turi momentinį patvirtinimą — nuomotojo atsakymo laukti nereikia.',
      success:'Nuomotojas turi {hours} aktyvias valandas atsakyti. Jei atsakymo nėra laiku, užsakymas automatiškai atšaukiamas.',
      more:'Kaip skaičiuojamas atsakymo laikas',
      today:'šiandien {time}', tomorrow:'rytoj {time}', date:'{date} {time}'
    },
    en:{
      title:'When will the supplier confirm?',
      request:'For this listing, the supplier has {hours} active hours to respond. Active hours run from 08:00 to 22:00 in the supplier’s local time; the clock pauses overnight.',
      deadline:'The supplier must respond by {when}.',
      deadlineLocal:'The supplier must respond by {when} (supplier local time).',
      noReply:'If there is no response by the deadline, the request is cancelled automatically. If a payment was reserved or completed, it is cancelled or refunded according to its payment status.',
      instant:'This listing uses Instant Book — you do not need to wait for supplier approval.',
      success:'The supplier has {hours} active hours to respond. If there is no response in time, the request is cancelled automatically.',
      more:'How supplier response time works',
      today:'today {time}', tomorrow:'tomorrow {time}', date:'{date} {time}'
    },
    es:{
      title:'¿Cuándo confirmará el proveedor?',
      request:'Para este anuncio, el proveedor dispone de {hours} horas activas para responder. Las horas activas son de 08:00 a 22:00 en la hora local del proveedor; el contador se pausa por la noche.',
      deadline:'El proveedor debe responder antes de {when}.',
      deadlineLocal:'El proveedor debe responder antes de {when} (hora local del proveedor).',
      noReply:'Si no responde antes del plazo, la solicitud se cancela automáticamente. Si el pago ya estaba reservado o realizado, se cancela o reembolsa según su estado.',
      instant:'Este anuncio usa Reserva inmediata: no necesitas esperar la aprobación del proveedor.',
      success:'El proveedor tiene {hours} horas activas para responder. Si no responde a tiempo, la solicitud se cancela automáticamente.',
      more:'Cómo funciona el plazo de respuesta',
      today:'hoy a las {time}', tomorrow:'mañana a las {time}', date:'{date} {time}'
    },
    de:{
      title:'Wann bestätigt der Anbieter?',
      request:'Für dieses Inserat hat der Anbieter {hours} aktive Stunden Zeit zu antworten. Aktive Stunden sind 08:00–22:00 Ortszeit des Anbieters; nachts pausiert die Uhr.',
      deadline:'Der Anbieter muss bis {when} antworten.',
      deadlineLocal:'Der Anbieter muss bis {when} antworten (Ortszeit des Anbieters).',
      noReply:'Kommt bis zur Frist keine Antwort, wird die Anfrage automatisch storniert. Eine reservierte oder bereits erfolgte Zahlung wird je nach Zahlungsstatus aufgehoben oder erstattet.',
      instant:'Dieses Inserat nutzt Sofortbuchung — du musst nicht auf die Bestätigung des Anbieters warten.',
      success:'Der Anbieter hat {hours} aktive Stunden Zeit zu antworten. Erfolgt keine rechtzeitige Antwort, wird die Anfrage automatisch storniert.',
      more:'So funktioniert die Antwortfrist',
      today:'heute {time}', tomorrow:'morgen {time}', date:'{date} {time}'
    },
    ru:{
      title:'Когда поставщик подтвердит заказ?',
      request:'Для этого объявления у поставщика есть {hours} активных часов на ответ. Активные часы считаются с 08:00 до 22:00 по местному времени поставщика; ночью таймер приостанавливается.',
      deadline:'Поставщик должен ответить до {when}.',
      deadlineLocal:'Поставщик должен ответить до {when} (по местному времени поставщика).',
      noReply:'Если ответа нет до срока, запрос отменяется автоматически. Если платёж был зарезервирован или уже проведён, он отменяется или возвращается в зависимости от статуса.',
      instant:'Для этого объявления действует мгновенное бронирование — ждать подтверждения поставщика не нужно.',
      success:'У поставщика есть {hours} активных часов на ответ. Если ответа нет вовремя, запрос отменяется автоматически.',
      more:'Как рассчитывается время ответа',
      today:'сегодня в {time}', tomorrow:'завтра в {time}', date:'{date} {time}'
    }
  };
  let authoritativeDueAt=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const lang=()=>window.RentInOrbitI18n?.getLanguage?.()||document.documentElement.lang||'lt';
  const copy=()=>COPY[lang()]||COPY.en;
  function validTimezone(value){const tz=String(value||'').trim();if(!tz)return null;try{new Intl.DateTimeFormat('en',{timeZone:tz}).format(new Date());return tz}catch{return null}}
  function listing(){try{if(typeof activeCheckoutListing!=='undefined'&&activeCheckoutListing)return activeCheckoutListing;if(typeof inferCheckoutListing==='function')return inferCheckoutListing()}catch{}return null}
  function timezoneFor(l){return validTimezone(l?.supplierTimezone)||COUNTRY_TZ[String(l?.country||'').toUpperCase()]||'UTC'}
  function zonedParts(date,timeZone){
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date);
    const bag={};for(const p of parts)if(p.type!=='literal')bag[p.type]=Number(p.value);
    return {year:bag.year,month:bag.month,day:bag.day,hour:bag.hour,minute:bag.minute,second:bag.second||0};
  }
  function zonedLocalToUtc(parts,timeZone){
    const target=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour||0,parts.minute||0,parts.second||0);let guess=target;
    for(let i=0;i<3;i++){const actual=zonedParts(new Date(guess),timeZone);const actualEpoch=Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second);const delta=target-actualEpoch;if(Math.abs(delta)<1000)break;guess+=delta}
    return new Date(guess);
  }
  function nextLocalDay(parts){const d=new Date(Date.UTC(parts.year,parts.month-1,parts.day+1));return {year:d.getUTCFullYear(),month:d.getUTCMonth()+1,day:d.getUTCDate()}}
  function addActiveMinutes(from,minutes,timeZone){
    const tz=validTimezone(timeZone)||'UTC';let cursor=new Date(from),remaining=Math.max(0,Number(minutes||0));
    for(let guard=0;guard<20&&remaining>0;guard++){
      let lp=zonedParts(cursor,tz);
      if(lp.hour<ACTIVE_START){cursor=zonedLocalToUtc({...lp,hour:ACTIVE_START,minute:0,second:0},tz);lp=zonedParts(cursor,tz)}
      else if(lp.hour>=ACTIVE_END){const n=nextLocalDay(lp);cursor=zonedLocalToUtc({...n,hour:ACTIVE_START,minute:0,second:0},tz);lp=zonedParts(cursor,tz)}
      const end=zonedLocalToUtc({...lp,hour:ACTIVE_END,minute:0,second:0},tz);const available=Math.max(0,Math.round((end-cursor)/60000));
      if(remaining<=available)return new Date(cursor.getTime()+remaining*60000);
      remaining-=available;const n=nextLocalDay(lp);cursor=zonedLocalToUtc({...n,hour:ACTIVE_START,minute:0,second:0},tz);
    }
    return cursor;
  }
  function estimatedDue(l){const hours=Math.max(1,Math.min(48,Number(l?.supplierResponseHours||4)));return addActiveMinutes(new Date(),hours*60,timezoneFor(l))}
  function dateKey(date,tz){const p=zonedParts(date,tz);return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`}
  function relativeWhen(date,tz){
    const c=copy(), locale=LOCALE[lang()]||'en-GB', now=new Date();
    const today=dateKey(now,tz), target=dateKey(date,tz);
    // Use a calendar-day comparison in supplier timezone, independent of active-hour arithmetic.
    const np=zonedParts(now,tz);const next=nextLocalDay(np);const tomorrowKey=`${next.year}-${String(next.month).padStart(2,'0')}-${String(next.day).padStart(2,'0')}`;
    const time=new Intl.DateTimeFormat(locale,{timeZone:tz,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date);
    if(target===today)return c.today.replace('{time}',time);
    if(target===tomorrowKey)return c.tomorrow.replace('{time}',time);
    const d=new Intl.DateTimeFormat(locale,{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    return c.date.replace('{date}',d).replace('{time}',time);
  }
  function deadlineText(l,dueAt){
    if(!l||l.bookingMode==='instant')return '';
    const tz=timezoneFor(l), due=dueAt?new Date(dueAt):estimatedDue(l), c=copy();
    if(Number.isNaN(due.getTime()))return '';
    const when=relativeWhen(due,tz);
    const browserTz=validTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)||'UTC';
    const template=browserTz===tz?c.deadline:c.deadlineLocal;
    return template.replace('{when}',when);
  }
  function render(){
    const box=document.getElementById('renterResponseInfo'),success=document.getElementById('renterResponseSuccess'),l=listing(),c=copy();
    if(box){
      if(!l){box.hidden=true;box.innerHTML=''}
      else if(l.bookingMode==='instant'){
        box.hidden=false;box.innerHTML=`<strong>${esc(c.title)}</strong><p>${esc(c.instant)}</p><a href="/help?lang=${encodeURIComponent(lang())}#renters" target="_blank" rel="noopener">${esc(c.more)}</a>`;
      }else{
        const hours=Math.max(1,Number(l.supplierResponseHours||4));const deadline=deadlineText(l,null);
        box.hidden=false;box.innerHTML=`<strong>${esc(c.title)}</strong>${deadline?`<p class="renter-response-deadline"><b>${esc(deadline)}</b></p>`:''}<p>${esc(c.request.replace('{hours}',hours))}</p><p class="renter-response-meta">${esc(c.noReply)}</p><a href="/help?lang=${encodeURIComponent(lang())}#renters" target="_blank" rel="noopener">${esc(c.more)}</a>`;
      }
    }
    if(success){
      const hours=Math.max(1,Number(l?.supplierResponseHours||4));
      if(l?.bookingMode==='instant')success.textContent=c.instant;
      else{
        const deadline=deadlineText(l,authoritativeDueAt);
        success.textContent=[deadline,c.success.replace('{hours}',hours)].filter(Boolean).join(' ');
      }
    }
  }
  document.addEventListener('rentinorbit:checkout-step',()=>setTimeout(render,0));
  document.addEventListener('rentinorbit:language-changed',()=>setTimeout(render,0));
  document.addEventListener('rentinorbit:booking-created',e=>{authoritativeDueAt=e.detail?.supplierResponseDueAt||authoritativeDueAt;setTimeout(render,0)});
  window.rentinorbitSupplierDeadline={estimate:(l,from=new Date())=>addActiveMinutes(from,Math.max(1,Number(l?.supplierResponseHours||4))*60,timezoneFor(l)).toISOString(),format:(l,dueAt)=>deadlineText(l,dueAt)};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();
