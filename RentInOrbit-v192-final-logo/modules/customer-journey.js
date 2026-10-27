// --- V120: customer end-to-end navigation shell ---
(function(){
  const stages=['discover','choose','book','track'];
  function setStage(stage){
    const n=stages.indexOf(stage);
    document.querySelectorAll('[data-v120-stage]').forEach((b,i)=>{b.classList.toggle('active',i===n);b.classList.toggle('done',i<n);});
    document.querySelectorAll('[data-v120-mobile]').forEach(b=>b.classList.toggle('active',(stage==='discover'&&b.dataset.v120Mobile==='discover')||(stage==='choose'&&b.dataset.v120Mobile==='browse')||(stage==='track'&&b.dataset.v120Mobile==='bookings')));
  }
  function scrollToId(id){document.getElementById(id)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
  function openBookings(){setStage('track');loadUnifiedCustomerBookings?.().catch(()=>{});scrollToId('customerBookingsSection');}
  function init(){
    document.getElementById('myBookingsBtn')?.addEventListener('click',openBookings);
    document.getElementById('v103ViewBookings')?.addEventListener('click',()=>{document.getElementById('checkoutModal')?.classList.remove('open');openBookings();});
    document.getElementById('v120EditSearch')?.addEventListener('click',()=>{setStage('discover');scrollToId('home');});
    document.querySelectorAll('[data-v120-stage]').forEach(b=>b.addEventListener('click',()=>{const st=b.dataset.v120Stage;setStage(st);if(st==='discover')scrollToId('home');if(st==='choose')scrollToId('browse');if(st==='book')document.getElementById('checkoutBtn')?.click();if(st==='track')openBookings();}));
    document.querySelectorAll('[data-v120-mobile]').forEach(b=>b.addEventListener('click',()=>{const x=b.dataset.v120Mobile;if(x==='discover')scrollToId('home');if(x==='browse')scrollToId('browse');if(x==='bookings')openBookings();if(x==='account')document.getElementById('supplierAuthBtn')?.click();}));
    document.getElementById('searchForm')?.addEventListener('submit',()=>setStage('choose'));document.getElementById('tripSearchForm')?.addEventListener('submit',()=>setStage('choose'));
    document.getElementById('checkoutBtn')?.addEventListener('click',()=>setStage('book'));
    document.getElementById('bookingForm')?.addEventListener('submit',()=>setStage('book'));
    const from=document.getElementById('fromDate'),to=document.getElementById('toDate'),city=document.getElementById('citySelect'),qty=document.getElementById('quantitySearch');
    const updateMeta=()=>{const bits=[];if(city?.value)bits.push(city.options?.[city.selectedIndex]?.text||city.value);if(from?.value&&to?.value)bits.push(`${from.value} → ${to.value}`);if(qty?.value)bits.push(`${qty.value} item${qty.value==='1'?'':'s'}`);document.getElementById('v120ResultsMeta').textContent=bits.length?bits.join(' · '):'Choose an item to see live availability and total price.';};
    [from,to,city,qty].forEach(el=>el?.addEventListener('change',updateMeta));updateMeta();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

