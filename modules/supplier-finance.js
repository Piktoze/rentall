// V133 supplier earnings/payout workspace. Read-only projection; server/Stripe remain authoritative.
(function(){
 const euro=v=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(Number(v||0));
 const bookings=()=>Array.isArray(window.bookings)?window.bookings:(Array.isArray(window.allBookings)?window.allBookings:[]);
 function finance(){
  const paid=bookings().filter(b=>['paid','partially_refunded'].includes(String(b.paymentStatus||b.payment_status||'').toLowerCase()));
  const gross=paid.reduce((n,b)=>n+Number(b.orderValue||b.total||0),0);
  const fee=paid.reduce((n,b)=>{const g=Number(b.orderValue||b.total||0),r=Number(b.platformFeeRate??0.15);return n+g*r},0);
  return {paid,gross,fee,net:Math.max(0,gross-fee)};
 }
 async function payoutStatus(){
  try{const r=await fetch('/api/stripe/connect/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error();return await r.json()}catch{return null}
 }
 async function render(){
  const f=finance(),e=document.getElementById('v133EarningsPanel');
  if(e)e.innerHTML=`<div class="v133-finance-kpis"><article><small>Gross paid rentals</small><strong>${euro(f.gross)}</strong></article><article><small>Platform fees</small><strong>${euro(f.fee)}</strong></article><article><small>Estimated supplier earnings</small><strong>${euro(f.net)}</strong></article><article><small>Paid bookings</small><strong>${f.paid.length}</strong></article></div><p class="muted">Figures are derived from recorded booking payment state. Stripe settlement remains authoritative.</p>`;
  const p=document.getElementById('v133PayoutsPanel'),st=await payoutStatus();if(!p)return;
  const ready=st?.connectApi==='v2_recipient'&&st?.transferCapabilityStatus==='active';
  p.innerHTML=ready?`<div class="v133-payout-ready"><strong>Payout account ready</strong><span>Stripe transfers capability is active. Final payout timing is determined by Stripe.</span></div>`:`<div class="v133-payout-attention"><strong>Payout setup needs attention</strong><span>${st?.accountId?'Continue Stripe verification before paid rentals are transferred.':'Connect and verify Stripe before accepting paid rentals.'}</span></div>`;
 }
 document.addEventListener('click',e=>{const b=e.target.closest('[data-v133-tab]');if(!b)return;document.querySelectorAll('[data-v133-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.v133-finance-panel').forEach(x=>x.classList.remove('active'));document.getElementById(`v133${b.dataset.v133Tab[0].toUpperCase()+b.dataset.v133Tab.slice(1)}Panel`)?.classList.add('active')});
 window.refreshSupplierFinance=render;document.addEventListener('DOMContentLoaded',()=>setTimeout(render,150));
})();
