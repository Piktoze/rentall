// V137 mobile E2E checkout polish. Session draft contains no payment credentials.
(function(){
 const labels=['','Rental','Delivery','Your details','Review','Payment'];
 const safeIds=['rentalStart','rentalEnd','accommodationType','deliveryArea','hotelName','deliveryAddress','hotelBookingName','roomNumber','deliveryInstructions','deliveryWindow','flightNumber','preferredLanguage','supplierNotes'];
 const key='rentall:checkout:draft:v1';
 function status(step){const el=document.getElementById('v137CheckoutStatus');if(!el)return;el.innerHTML=`<strong>${labels[step]||'Booking'}</strong><span>Step ${step} of 5</span>`}
 function save(){const d={};safeIds.forEach(id=>{const e=document.getElementById(id);if(e&&e.value)d[id]=e.value});try{sessionStorage.setItem(key,JSON.stringify(d))}catch{}}
 function restore(){let d={};try{d=JSON.parse(sessionStorage.getItem(key)||'{}')}catch{};safeIds.forEach(id=>{const e=document.getElementById(id);if(e&&!e.value&&d[id])e.value=d[id]})}
 function bind(){restore();safeIds.forEach(id=>{const e=document.getElementById(id);if(e&&!e.dataset.v137Draft){e.dataset.v137Draft='1';e.addEventListener('change',save);e.addEventListener('input',save)}});document.getElementById('checkoutBtn')?.addEventListener('click',()=>setTimeout(()=>{restore();status(1)},0))}
 document.addEventListener('rentall:checkout-step',e=>{const n=Number(e.detail?.step||1);status(n);const active=document.querySelector(`.checkout-step[data-step="${n}"]`);if(active&&matchMedia('(max-width: 700px)').matches)active.querySelector('h2')?.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})});
 document.addEventListener('DOMContentLoaded',bind);
 window.rentallClearCheckoutDraft=()=>{try{sessionStorage.removeItem(key)}catch{}};
})();
