// V140 customer post-booking command center. Presentation only; server booking state is authoritative.
(function(){
 let current=null;
 const tr=k=>window.RentInOrbitI18n?.t?.(k)||k;
 const text=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=tr(v)};
 const rawText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=String(v??'')};
 function choose(b){
  current=b||null;
  if(!b){
    text('v140NextAction','Choose a booking');
    text('v140NextHint','Your next step will appear here.');
    text('v140PaymentState','—');
    text('v140Fulfilment','—');
    text('v140FulfilmentHint','Details appear after confirmation.');
    return;
  }
  const payment=String(b.paymentStatus||b.payment_status||'pending').toLowerCase();
  const status=String(b.status||'pending').toLowerCase();
  const paymentCopy={
    paid:'Paid',processing:'Processing',
    refunded:'Payment refunded',partially_refunded:'Partially refunded'
  };
  text('v140PaymentState',paymentCopy[payment]||'Pending');
  if(status==='cancelled'||status==='canceled'){
    text('v140NextAction','Cancelled');
    text('v140NextHint','Booking cancelled. Check payment status for any refund.');
  }else if(status==='declined'){
    text('v140NextAction','Declined');
    text('v140NextHint','Check this booking for the latest status.');
  }else if(status==='completed'){
    text('v140NextAction','Rental completed. You can leave a review.');
    text('v140NextHint','Check this booking for the latest status.');
  }else if(status==='returned'){
    text('v140NextAction','Item returned — waiting for completion.');
    text('v140NextHint','Check this booking for the latest status.');
  }else if(payment==='processing'){
    text('v140NextAction','Wait for payment confirmation');
    text('v140NextHint','Do not pay again while the payment is processing.');
  }else if(status==='active'){
    text('v140NextAction','Rental in progress — keep the item safe until return.');
    text('v140NextHint','Check this booking for the latest status.');
  }else if(!['confirmed','ready','active'].includes(status)){
    text('v140NextAction','Wait for supplier confirmation');
    text('v140NextHint','Payment becomes available only after supplier approval.');
  }else if(payment==='refunded'||payment==='partially_refunded'){
    text('v140NextAction',payment==='refunded'?'Payment refunded':'Partially refunded');
    text('v140NextHint','Check this booking for the latest status.');
  }else if(payment!=='paid'){
    text('v140NextAction','Complete payment');
    text('v140NextHint','Use the secure payment action on this booking.');
  }else{
    text('v140NextAction',status==='ready'?'Ready for pickup':'Booking confirmed');
    text('v140NextHint','Review the pickup or delivery details before the rental starts.');
  }
  const mode=b.deliveryMethod||b.fulfilment||b.fulfillment||'Pickup';
  if(['Pickup','Delivery'].includes(String(mode)))text('v140Fulfilment',mode);
  else rawText('v140Fulfilment',mode);
  const address=b.pickupAddress||b.deliveryAddress;
  if(address)rawText('v140FulfilmentHint',address);
  else text('v140FulfilmentHint','Exact details remain on the confirmed booking.');
 }
 document.addEventListener('rentinorbit:booking-selected',e=>choose(e.detail?.booking||e.detail));
 document.addEventListener('rentinorbit:language-changed',()=>choose(current));
 document.addEventListener('click',e=>{
  if(e.target.closest('#v140RefreshBooking')){window.refreshCustomerBookings?.();window.refreshLiveBookingStatus?.();}
  if(e.target.closest('#v140CopyBooking')&&current?.id){navigator.clipboard?.writeText(String(current.id));text('v140NextHint','Booking ID copied.');}
 });
 window.rentinorbitBookingCommandSelect=choose;
})();
