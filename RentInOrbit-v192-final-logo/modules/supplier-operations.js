// V128 supplier operations cockpit — presentation-only snapshot consumer.
(function(){
 let bookings=[],listings=[]; const fee=.15;
 const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 const eur=v=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(Number(v||0));
 const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const status=b=>String(b.status||'pending').toLowerCase();
 const urgent=b=>['pending','requested','return_requested','disputed'].includes(status(b));
 function render(){
  const live=listings.filter(l=>l.active!==false&&l.status!=='draft'), action=bookings.filter(urgent), upcoming=bookings.filter(b=>['confirmed','approved'].includes(status(b)));
  const earning=bookings.filter(b=>['confirmed','approved','active','returned','completed'].includes(status(b))).reduce((n,b)=>{const recorded=Number(b.supplierAmount);return n+(recorded>0?recorded:Math.max(0,Number(b.orderValue||0)*(1-fee)))},0);
  set('v128LiveListings',live.length);set('v128NeedsAction',action.length);set('v128UpcomingBookings',upcoming.length);set('v128EstimatedEarnings',eur(earning));
  const q=document.getElementById('v128ActionQueue');if(q)q.innerHTML=action.length?action.slice(0,5).map(b=>`<div class="v128-action-row"><div><strong>${esc(b.title||'Rental')}</strong><span>${esc(status(b))}</span></div><small>${esc(b.startDate||'')}</small></div>`).join(''):'<p class="muted">No urgent booking actions.</p>';
 }
 async function payout(){const box=document.getElementById('v128PayoutReadiness');if(!box)return;try{const r=await fetch('/api/stripe/connect/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw 0;const st=await r.json(),ready=st.connectApi==='v2_recipient'&&st.transferCapabilityStatus==='active';box.innerHTML=ready?'<strong>Payouts ready</strong><span>Stripe transfers are active.</span>':`<strong>Payout setup required</strong><span>${st.accountId?'Continue Stripe verification.':'Connect Stripe before accepting paid rentals.'}</span>`}catch{box.innerHTML='<strong>Payout status unavailable</strong><span>Refresh after signing in as a supplier.</span>'}}
 window.addEventListener('rentinorbit:supplier-bookings',e=>{bookings=Array.isArray(e.detail?.bookings)?e.detail.bookings:[];render()});window.addEventListener('rentinorbit:supplier-inventory',e=>{listings=Array.isArray(e.detail?.listings)?e.detail.listings:[];render()});
 document.addEventListener('click',e=>{if(e.target.closest('#v128RefreshSupplier')){window.renderBookings?.();payout()}const j=e.target.closest('[data-v128-jump]');if(j)document.getElementById(j.dataset.v128Jump)?.scrollIntoView({behavior:'smooth',block:'start'})});document.addEventListener('DOMContentLoaded',payout);
})();