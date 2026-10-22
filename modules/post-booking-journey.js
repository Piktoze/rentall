// V103 — post-booking journey clarity
function updatePostBookingJourneyV103(result){
 const booking=result?.booking||{},payment=document.getElementById('v103PaymentStep');
 if(payment){
   const paid=booking.paymentStatus==='paid';
   payment.classList.toggle('done',paid);
   const small=payment.querySelector('small');
   if(small)small.textContent=paid?'Payment received.':'Complete payment when shown below.';
 }
 const lead=document.getElementById('v103SuccessLead');
 if(lead)lead.textContent=booking.status==='confirmed'
   ?'Your rental is confirmed. Keep an eye on My Bookings for pickup or delivery details.'
   :'Your request has been created. Payment and supplier confirmation may still be required.';
}
const v103RenderBookingConfirmation=renderBookingConfirmation;
renderBookingConfirmation=function(result){v103RenderBookingConfirmation(result);updatePostBookingJourneyV103(result)};
document.getElementById('v103ViewBookings')?.addEventListener('click',async()=>{
 modal?.classList.remove('open');modal?.setAttribute('aria-hidden','true');
 try{await loadCustomerBookingsSecure()}catch{}
 document.getElementById('myBookingsBtn')?.click();
});
