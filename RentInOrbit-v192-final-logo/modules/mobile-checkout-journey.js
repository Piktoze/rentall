// V137 mobile E2E checkout polish. Session draft contains no payment credentials.
(function(){
 const labels=['','Rental details','Handover','Your details','Review','Payment'];
 const safeIds=['rentalStart','rentalEnd','accommodationType','deliveryArea','hotelName','deliveryAddress','hotelBookingName','roomNumber','deliveryInstructions','deliveryWindow','flightNumber','preferredLanguage','supplierNotes'];
 const key='rentinorbit:checkout:draft:v1';
 function status(step){const el=document.getElementById('v137CheckoutStatus');if(!el)return;const phase=step<=2?1:(step===3?2:3),phaseLabel=phase===1?'Rental & handover':phase===2?'Your details':'Review & pay';el.innerHTML=`<strong>${phaseLabel}</strong><span>Part ${phase} of 3</span>`}
 function save(){const d={};safeIds.forEach(id=>{const e=document.getElementById(id);if(e&&e.value)d[id]=e.value});try{sessionStorage.setItem(key,JSON.stringify(d))}catch{}}
 function restore(){let d={};try{d=JSON.parse(sessionStorage.getItem(key)||'{}')}catch{};safeIds.forEach(id=>{const e=document.getElementById(id);if(e&&!e.value&&d[id])e.value=d[id]})}
 function bind(){restore();safeIds.forEach(id=>{const e=document.getElementById(id);if(e&&!e.dataset.v137Draft){e.dataset.v137Draft='1';e.addEventListener('change',save);e.addEventListener('input',save)}});document.getElementById('checkoutBtn')?.addEventListener('click',()=>setTimeout(()=>{restore();status(1)},0))}
 document.addEventListener('rentinorbit:checkout-step',e=>{const n=Number(e.detail?.step||1);status(n);const active=document.querySelector(`.checkout-step[data-step="${n}"]`);if(active&&matchMedia('(max-width: 700px)').matches)active.querySelector('h2')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
 document.addEventListener('DOMContentLoaded',bind);
 window.rentinorbitClearCheckoutDraft=()=>{try{sessionStorage.removeItem(key)}catch{}};
})();
