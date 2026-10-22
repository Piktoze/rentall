// V111 — progressive listing creation
(function listingPolishV111(){
 const delivery=document.getElementById('listingDelivery');
 const deliveryIds=['listingAccommodationDelivery','listingDeliveryZones','listingHotelDeliveryFee','listingMinOrder','listingDeliveryLeadTime','listingDeliveryWindow'];
 function syncDelivery(){
   const enabled=delivery && delivery.value!=='Pickup only';
   deliveryIds.forEach(id=>{
     const el=document.getElementById(id);if(!el)return;
     const label=el.closest('label');if(label)label.hidden=!enabled;
     el.disabled=!enabled;
   });
 }
 delivery?.addEventListener('change',syncDelivery);syncDelivery();
 const form=document.getElementById('listingForm');
 form?.addEventListener('input',()=>{
   const required=[document.getElementById('listingTitle'),document.getElementById('listingCity'),document.getElementById('listingPriceDay')];
   const complete=required.every(el=>String(el?.value||'').trim());
   form.dataset.essentialsComplete=String(complete);
 });
})();
