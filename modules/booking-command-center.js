// V140 customer post-booking command center. Presentation only; server booking state is authoritative.
(function(){
 let current=null;
 const text=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
 function choose(b){
  current=b||null;if(!b)return;
  const payment=String(b.paymentStatus||b.payment_status||'pending').toLowerCase();
  const status=String(b.status||'pending').toLowerCase();
  text('v140PaymentState',payment==='paid'?'Paid':payment==='processing'?'Processing':'Pending');
  if(payment==='processing'){text('v140NextAction','Wait for payment confirmation');text('v140NextHint','Do not pay again while the payment is processing.')}
  else if(payment!=='paid'){text('v140NextAction','Complete payment');text('v140NextHint','Use the secure payment action on this booking.')}
  else if(!['confirmed','ready','active','completed'].includes(status)){text('v140NextAction','Wait for supplier confirmation');text('v140NextHint','Your payment is recorded; the supplier confirmation is next.')}
  else {text('v140NextAction',status==='ready'?'Ready for pickup':'Booking confirmed');text('v140NextHint','Review the pickup or delivery details before the rental starts.')}
  const mode=b.deliveryMethod||b.fulfilment||b.fulfillment||'Pickup';
  text('v140Fulfilment',mode);text('v140FulfilmentHint',b.pickupAddress||b.deliveryAddress||'Exact details remain on the confirmed booking.');
 }
 document.addEventListener('rentall:booking-selected',e=>choose(e.detail?.booking||e.detail));
 document.addEventListener('click',e=>{
  if(e.target.closest('#v140RefreshBooking')){window.refreshCustomerBookings?.();window.refreshLiveBookingStatus?.();}
  if(e.target.closest('#v140CopyBooking')&&current?.id){navigator.clipboard?.writeText(String(current.id));text('v140NextHint','Booking ID copied.');}
 });
 window.rentallBookingCommandSelect=choose;
})();
