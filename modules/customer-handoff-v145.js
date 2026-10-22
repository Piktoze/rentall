// V145: server-checked listing → availability → exact-listing checkout handoff.
(function(){
 let checked=null;
 window.rentallAvailabilityClass=day=>day.remainingQuantity<=0?'soldout':day.remainingQuantity<day.totalQuantity?'limited':'free';

 window.rentallRenderAvailabilityCalendar=async()=>{
  if(!activeAvailabilityListing)return;
  const from=document.getElementById('availabilityFrom').value,to=document.getElementById('availabilityTo').value,grid=document.getElementById('availabilityCalendarGrid');if(!from||!to)return;
  grid.innerHTML='<div>Loading…</div>';
  try{await syncListingsToServer();const data=await apiJson(`/api/rentals/calendar?listingId=${encodeURIComponent(activeAvailabilityListing.id)}&fromDate=${encodeURIComponent(from)}&toDate=${encodeURIComponent(to)}`);grid.innerHTML=data.days.map(day=>`<div class="availability-day ${window.rentallAvailabilityClass(day)}"><b>${day.date}</b><small>${day.remainingQuantity} of ${day.totalQuantity} available</small></div>`).join('')}
  catch(err){grid.innerHTML=`<div class="webhook-error">${escapeHtml(err.message||'Unknown error')}</div>`}
 };

 async function checkSelection(){
  if(!activeAvailabilityListing)return false;
  const from=document.getElementById('availabilityFrom')?.value||'';
  const to=document.getElementById('availabilityTo')?.value||'';
  const quantity=Math.max(1,Number(document.getElementById('availabilityQuantity')?.value||1));
  const result=document.getElementById('v145AvailabilityResult');
  const proceed=document.getElementById('v145AvailabilityContinue');
  proceed.disabled=true;checked=null;
  if(!from||!to||to<=from){result.textContent='Choose an end date after the start date.';result.dataset.state='error';return false}
  result.textContent='Checking live availability…';result.dataset.state='loading';
  try{
   await syncListingsToServer();
   const data=await fetchAvailability(activeAvailabilityListing.id,from,to,quantity);
   checked={...data,from,to,quantity};
   result.textContent=data.available?`${quantity} ${quantity===1?'unit':'units'} available for your full rental. Continue to reserve.`:`Not enough inventory for the full rental. ${data.remainingQuantity||0} available.`;
   result.dataset.state=data.available?'success':'error';proceed.disabled=!data.available;
   await renderAvailabilityCalendar();
   return Boolean(data.available);
  }catch(err){result.textContent=err.message||'Live availability could not be checked. Try again.';result.dataset.state='error';return false}
 }

 window.rentallOpenAvailabilityV145=async function(listingId){
  const listing=loadUniversalListings().find(l=>String(l.id)===String(listingId));if(!listing)return;
  activeAvailabilityListing=listing;checked=null;
  document.getElementById('availabilityTitle').textContent=`${listing.title} availability`;
  const todayIso=new Date().toISOString().slice(0,10),ctx=getCurrentSearchContext();
  const from=ctx.from>=todayIso?ctx.from:todayIso,next=new Date(`${from}T00:00:00`);next.setDate(next.getDate()+7);
  const to=ctx.to>from?ctx.to:next.toISOString().slice(0,10);
  const fromEl=document.getElementById('availabilityFrom'),toEl=document.getElementById('availabilityTo'),qty=document.getElementById('availabilityQuantity');
  fromEl.min=todayIso;fromEl.value=from;toEl.min=from;toEl.value=to;
  qty.max=String(Math.max(1,Number(listing.quantity||1)));qty.value=String(Math.min(Number(qty.max),Math.max(1,Number(ctx.qty||1))));
  document.getElementById('v145AvailabilityContinue').disabled=true;
  const modal=document.getElementById('availabilityModal');modal.classList.add('open');modal.setAttribute('aria-hidden','false');
  await checkSelection();
 };
 openAvailabilityCalendar=window.rentallOpenAvailabilityV145;

 window.rentallCheckoutAvailabilityPreflight=async({listing,startDate,endDate,quantity})=>{
  const status=document.getElementById('v145CheckoutPreflight');status.textContent='Checking live availability…';status.dataset.state='loading';
  if(!listing){status.textContent='This listing could not be resolved. Return to the listing and try again.';status.dataset.state='error';return false}
  try{
   const data=await fetchAvailability(listing.id,startDate,endDate,quantity);
   status.textContent=data.available?`Available · ${data.remainingQuantity} remain after this reservation.`:`Those dates are no longer available for ${quantity} ${quantity===1?'unit':'units'}. ${data.remainingQuantity||0} remain.`;
   status.dataset.state=data.available?'success':'error';return Boolean(data.available);
  }catch(err){status.textContent=err.message||'Availability could not be verified. Try again.';status.dataset.state='error';return false}
 };

 const oldRefresh=document.getElementById('refreshAvailabilityBtn');
 if(oldRefresh){const fresh=oldRefresh.cloneNode(true);oldRefresh.replaceWith(fresh);fresh.addEventListener('click',checkSelection)}
 document.getElementById('availabilityFrom')?.addEventListener('change',e=>{const to=document.getElementById('availabilityTo');if(to){to.min=e.target.value;if(to.value<=e.target.value)to.value=''}document.getElementById('v145AvailabilityContinue').disabled=true});
 ['availabilityTo','availabilityQuantity'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{document.getElementById('v145AvailabilityContinue').disabled=true}));
 document.getElementById('v145AvailabilityContinue')?.addEventListener('click',()=>{
  if(!activeAvailabilityListing||!checked?.available)return;
  const prior=getTripContext()||{};
  localStorage.setItem('rentall_trip_search',JSON.stringify({...prior,listingId:activeAvailabilityListing.id,country:activeAvailabilityListing.country||prior.country||'',city:prior.city||activeAvailabilityListing.city||'',from:checked.from,to:checked.to,qty:checked.quantity,keyword:'',category:'all'}));
  cart=[{name:activeAvailabilityListing.title,price:calculateListingPreview(activeAvailabilityListing,{from:checked.from,to:checked.to,qty:checked.quantity,mode:'local'}).rental}];renderCart();
  const modal=document.getElementById('availabilityModal');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.getElementById('checkoutBtn')?.click();
 });
 document.getElementById('closeAvailabilityModal')?.addEventListener('click',()=>document.getElementById('availabilityModal').setAttribute('aria-hidden','true'));
})();
