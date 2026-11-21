// Adds explicit bilateral acceptance only when the authoritative server exposes a new commercial order.
(function(){
 async function attach(root,id){
  if(!root||root.querySelector('[data-rio-return-acceptance]'))return;
  const marker=document.createElement('div');marker.dataset.rioReturnAcceptance='checking';root.append(marker);
  try{const r=await fetch(`/api/rentals/bookings/${encodeURIComponent(id)}/return-acceptance`,{credentials:'same-origin',cache:'no-store'});if(!r.ok){marker.hidden=true;return;}const state=await r.json();
   marker.dataset.rioReturnAcceptance='ready';const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent=state.accepted?'Tinkamas grąžinimas patvirtintas':'Patvirtinu tinkamą daikto grąžinimą';button.disabled=state.accepted;
   marker.append(button);button.addEventListener('click',async()=>{if(!confirm('Patvirtinu, kad daiktas tinkamai grąžintas. Abiejų šalių patvirtinimas, nesant ginčo ar sulaikymo, užbaigia tarpininkavimo paslaugą.'))return;button.disabled=true;
    try{const x=await fetch(`/api/rentals/bookings/${encodeURIComponent(id)}/return-acceptance`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({condition:'good'})});if(!x.ok)throw Error('Patvirtinti nepavyko. Atnaujinkite užsakymą.');button.textContent='Tinkamas grąžinimas patvirtintas';}catch(e){button.disabled=false;alert(e.message);}});
  }catch{marker.hidden=true;}
 }
 window.RentInOrbitReturnCompletion={attach};
 let timer;const scan=()=>{clearTimeout(timer);timer=setTimeout(()=>document.querySelectorAll('.customer-booking-card[data-booking-id][data-booking-status="returned"]').forEach(el=>attach(el,el.dataset.bookingId)),100);};
 new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});scan();
})();
