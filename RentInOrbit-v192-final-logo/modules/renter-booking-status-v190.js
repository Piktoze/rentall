(function(){
  const COPY={
    lt:{
      title:'Užsakymo būsena',waiting:'Laukiamas tiekėjo atsakymas',confirmed:'Patvirtinta',declined:'Atmesta',auto:'Automatiškai atšaukta',cancelled:'Atšaukta',
      waitingMsg:'Tiekėjas dar neatsakė. Jei atsakymo nebus iki nustatyto termino, užsakymas bus automatiškai atšauktas.',
      confirmedMsg:'Tiekėjas patvirtino užsakymą. Toliau sek pristatymo arba atsiėmimo informaciją šiame užsakyme.',
      declinedMsg:'Tiekėjas atmetė užsakymą. Jei mokėjimas jau buvo atliktas, visa nuomos suma grąžinama.',
      autoNoReplyMsg:'Tiekėjas neatsakė iki termino, todėl užsakymas automatiškai atšauktas. Jei mokėjimas jau buvo atliktas, visa nuomos suma grąžinama.',
      autoExpiredMsg:'Užsakymas automatiškai atšauktas, nes rezervacija nebuvo užbaigta laiku.',
      cancelledMsg:'Šis užsakymas atšauktas.',deadline:'Atsakymo terminas: {value}'
    },
    en:{
      title:'Booking status',waiting:'Waiting for supplier',confirmed:'Confirmed',declined:'Declined',auto:'Auto-cancelled',cancelled:'Cancelled',
      waitingMsg:'The supplier has not responded yet. If there is no response by the deadline, the request will be cancelled automatically.',
      confirmedMsg:'The supplier confirmed your booking. Follow the pickup or delivery details in this booking.',
      declinedMsg:'The supplier declined the booking. If payment was already completed, the full rental amount is refunded.',
      autoNoReplyMsg:'The supplier did not respond by the deadline, so the booking was cancelled automatically. If payment was already completed, the full rental amount is refunded.',
      autoExpiredMsg:'The booking was cancelled automatically because the reservation was not completed in time.',
      cancelledMsg:'This booking has been cancelled.',deadline:'Response deadline: {value}'
    },
    es:{
      title:'Estado de la reserva',waiting:'Esperando al proveedor',confirmed:'Confirmada',declined:'Rechazada',auto:'Cancelada automáticamente',cancelled:'Cancelada',
      waitingMsg:'El proveedor aún no ha respondido. Si no responde antes del plazo, la solicitud se cancelará automáticamente.',
      confirmedMsg:'El proveedor confirmó la reserva. Consulta aquí los detalles de recogida o entrega.',
      declinedMsg:'El proveedor rechazó la reserva. Si el pago ya se realizó, se reembolsa el importe total del alquiler.',
      autoNoReplyMsg:'El proveedor no respondió antes del plazo, por lo que la reserva se canceló automáticamente. Si el pago ya se realizó, se reembolsa el importe total del alquiler.',
      autoExpiredMsg:'La reserva se canceló automáticamente porque no se completó a tiempo.',
      cancelledMsg:'Esta reserva ha sido cancelada.',deadline:'Plazo de respuesta: {value}'
    },
    de:{
      title:'Buchungsstatus',waiting:'Warten auf Anbieter',confirmed:'Bestätigt',declined:'Abgelehnt',auto:'Automatisch storniert',cancelled:'Storniert',
      waitingMsg:'Der Anbieter hat noch nicht geantwortet. Erfolgt bis zur Frist keine Antwort, wird die Anfrage automatisch storniert.',
      confirmedMsg:'Der Anbieter hat die Buchung bestätigt. Abhol- oder Lieferdetails findest du in dieser Buchung.',
      declinedMsg:'Der Anbieter hat die Buchung abgelehnt. Wurde bereits bezahlt, wird der gesamte Mietbetrag erstattet.',
      autoNoReplyMsg:'Der Anbieter hat nicht rechtzeitig geantwortet, daher wurde die Buchung automatisch storniert. Wurde bereits bezahlt, wird der gesamte Mietbetrag erstattet.',
      autoExpiredMsg:'Die Buchung wurde automatisch storniert, weil die Reservierung nicht rechtzeitig abgeschlossen wurde.',
      cancelledMsg:'Diese Buchung wurde storniert.',deadline:'Antwortfrist: {value}'
    },
    ru:{
      title:'Статус заказа',waiting:'Ожидается ответ поставщика',confirmed:'Подтверждено',declined:'Отклонено',auto:'Отменено автоматически',cancelled:'Отменено',
      waitingMsg:'Поставщик ещё не ответил. Если ответа не будет до установленного срока, заказ отменится автоматически.',
      confirmedMsg:'Поставщик подтвердил заказ. Информация о получении или доставке доступна в этом заказе.',
      declinedMsg:'Поставщик отклонил заказ. Если оплата уже была проведена, полная сумма аренды возвращается.',
      autoNoReplyMsg:'Поставщик не ответил до срока, поэтому заказ был отменён автоматически. Если оплата уже была проведена, полная сумма аренды возвращается.',
      autoExpiredMsg:'Заказ был отменён автоматически, потому что бронирование не было завершено вовремя.',
      cancelledMsg:'Этот заказ отменён.',deadline:'Срок ответа: {value}'
    }
  };
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const lang=()=>window.RentInOrbitI18n?.getLanguage?.()||document.documentElement.lang||'lt';
  const copy=()=>COPY[lang()]||COPY.en;
  const status=b=>String(b?.status||'pending').toLowerCase();
  const autoDeclined=b=>Boolean(b?.supplierAutoDeclinedAt||b?.supplier_auto_declined_at);
  function stateFor(b){
    const s=status(b);
    if(s==='pending')return 'waiting';
    if(['confirmed','active','returned','completed'].includes(s))return 'confirmed';
    if(s==='declined')return autoDeclined(b)?'auto':'declined';
    if(s==='expired')return 'auto';
    if(s==='cancelled')return 'cancelled';
    return 'waiting';
  }
  function labels(){const c=copy();return {waiting:c.waiting,confirmed:c.confirmed,declined:c.declined,auto:c.auto}}
  function label(b){const c=copy(),s=stateFor(b);return s==='cancelled'?c.cancelled:(labels()[s]||c.waiting)}
  function deadlineValue(b){
    if(!b?.supplierResponseDueAt||stateFor(b)!=='waiting')return '';
    const d=new Date(b.supplierResponseDueAt);if(Number.isNaN(d.getTime()))return '';
    const locale={lt:'lt-LT',en:'en-GB',es:'es-ES',de:'de-DE',ru:'ru-RU'}[lang()]||'en-GB';
    return new Intl.DateTimeFormat(locale,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(d);
  }
  function message(b){
    const c=copy(),s=stateFor(b);
    if(s==='waiting')return c.waitingMsg;
    if(s==='confirmed')return c.confirmedMsg;
    if(s==='declined')return c.declinedMsg;
    if(s==='auto')return autoDeclined(b)?c.autoNoReplyMsg:c.autoExpiredMsg;
    return c.cancelledMsg;
  }
  function render(b,{compact=false}={}){
    const c=copy(),current=stateFor(b),ls=labels(),deadline=deadlineValue(b);
    const options=['waiting','confirmed','declined','auto'].map(key=>`<div class="renter-booking-state-option state-${key}${current===key?' current':''}" ${current===key?'aria-current="true"':''}><span class="renter-booking-state-dot" aria-hidden="true"></span><strong>${esc(ls[key])}</strong></div>`).join('');
    return `<section class="renter-booking-statusbar current-${esc(current)}${compact?' compact':''}" data-renter-booking-status="${esc(current)}" role="status" aria-live="polite"><div class="renter-booking-status-head"><span>${esc(c.title)}</span><b>${esc(label(b))}</b></div><div class="renter-booking-state-track">${options}</div>${deadline?`<p class="renter-booking-status-deadline">${esc(c.deadline.replace('{value}',deadline))}</p>`:''}<p class="renter-booking-status-message">${esc(message(b))}</p></section>`;
  }
  function mount(target,b,opts={}){const el=typeof target==='string'?document.getElementById(target):target;if(el)el.innerHTML=render(b,opts);return el}
  window.rentinorbitBookingStatus={stateFor,label,message,render,mount};
  document.addEventListener('rentinorbit:language-changed',()=>{if(window.__rentinorbitLatestBooking?.booking)mount('v190LiveBookingStatus',window.__rentinorbitLatestBooking.booking);});
})();
