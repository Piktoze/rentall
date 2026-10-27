// V143 — supplier command center. Read-only operational projection; server remains authoritative.
(function(){
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
 const euro=v=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(v||0));
 const bookings=()=>Array.isArray(window.liveSupplierBookings)?window.liveSupplierBookings:(Array.isArray(window.bookings)?window.bookings:(Array.isArray(window.allBookings)?window.allBookings:[]));
 const listings=()=>Array.isArray(window.v94SupplierListings)?window.v94SupplierListings:(Array.isArray(window.listings)?window.listings:[]);
 const status=b=>String(b.status||'').toLowerCase(), pay=b=>String(b.paymentStatus||b.payment_status||'').toLowerCase();
 function render(){
  const b=bookings(),l=listings();
  const attention=b.filter(x=>['pending','requested','payment_pending'].includes(status(x))||['failed','requires_action'].includes(pay(x)));
  const active=b.filter(x=>status(x)==='active');
  const paid=b.filter(x=>['paid','partially_refunded'].includes(pay(x)));
  const revenue=paid.reduce((n,x)=>n+Math.max(0,Number(x.orderValue||x.total||0)),0);
  const units=l.reduce((n,x)=>n+Math.max(0,Number(x.quantity||1)),0);
  const today=new Date();today.setHours(0,0,0,0);const week=new Date(today);week.setDate(week.getDate()+7);
  const booked7=b.filter(x=>{const s=new Date(x.startDate||0),e=new Date(x.endDate||0);return !['cancelled','declined','expired'].includes(status(x))&&s<week&&e>=today}).reduce((n,x)=>n+Math.max(1,Number(x.quantity||1)),0);
  const occupancy=units?Math.min(100,Math.round((booked7/units)*100)):0;
  const cards=document.querySelectorAll('#v143SupplierKpis article strong');
  [String(attention.length),String(active.length),`${occupancy}%`,euro(revenue)].forEach((v,i)=>{if(cards[i])cards[i].textContent=v});
  const q=document.getElementById('v143PriorityQueue');if(q)q.innerHTML=attention.length?attention.slice(0,5).map(x=>`<article class="v143-priority"><div><strong>${esc(x.title||x.itemName||x.listingTitle||'Rental')}</strong><span>${esc(x.bookingId||'Booking')} · ${esc(x.startDate||'date pending')}</span></div><em>${esc(pay(x)==='failed'?'Payment failed':status(x).replaceAll('_',' ')||'Review')}</em></article>`).join(''):'<div class="v129-empty"><strong>Queue clear</strong><span>No booking needs immediate attention.</span></div>';
  const h=document.getElementById('v143Health');if(h){const drafts=l.filter(x=>x.active===false||String(x.status||'').toLowerCase()==='draft').length;h.innerHTML=`<article class="${drafts?'warn':'ok'}"><strong>${drafts?`${drafts} listing${drafts===1?'':'s'} need publishing`:'Inventory ready'}</strong><span>${l.length} listings · ${units} rentable units</span></article><article class="${paid.length?'ok':'warn'}"><strong>${paid.length?'Revenue tracking active':'No paid rentals yet'}</strong><span>${paid.length} paid booking${paid.length===1?'':'s'} recorded</span></article><article class="ok"><strong>Server-authoritative checkout</strong><span>Prices, availability and payment state are not trusted from the browser.</span></article>`}
 }
 function jump(id){const el=document.getElementById(id);if(!el)return;el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-v143-jump]');if(b)jump(b.dataset.v143Jump)});
 document.getElementById('v143RefreshCommand')?.addEventListener('click',render);
 window.refreshSupplierCommandV143=render;window.addEventListener('rentinorbit:supplier-inventory',render);document.addEventListener('DOMContentLoaded',()=>setTimeout(render,180));
})();
