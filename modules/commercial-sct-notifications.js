// Durable outbox only: never sends mail in a financial transaction.
export function commercialSctNotifications({db,enqueue}){
 function queue(kind,{bookingId,paymentIntentId,amountCents}){
  if(!db.inTransaction)throw new Error('COMMERCIAL_NOTIFICATION_TRANSACTION_REQUIRED');
  const row=db.prepare(`SELECT b.customer_email,l.owner_email,l.title FROM rental_bookings b JOIN rental_listings l USING(listing_id) WHERE b.booking_id=?`).get(bookingId);
  if(!row)throw new Error('COMMERCIAL_NOTIFICATION_BOOKING_MISSING');
  for(const [audience,recipient] of [['customer',row.customer_email],['supplier',row.owner_email]]){
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient||''))continue;
   const paid=kind==='paid';
   enqueue({recipient,templateKey:paid?(audience==='customer'?'booking_paid':'booking_paid_supplier'):(audience==='customer'?'booking_cancelled':'booking_cancelled_supplier'),
    subject:`RentInOrbit · ${paid?'Mokėjimas gautas':'Nuoma atšaukta'} · ${bookingId}`,
    dedupeKey:paid?`booking:${bookingId}:payment:${paymentIntentId}:${audience}-email`:`booking:${bookingId}:cancelled:email:${audience}`,
    payload:{templateVersion:1,bookingId,listingTitle:row.title||'Nuomojamas daiktas',status:paid?'paid':'cancelled',
     message:paid?'Mokėjimas gautas. Nuomotojo dalis yra 85 % nuomos sumos. Stripe kaštus dengia platforma; pervedimas į Stripe balansą atliekamas tik po tinkamo grąžinimo ir nesant sulaikymo.':`Nuoma atšaukta. Patvirtintas visas pinigų grąžinimas: ${(amountCents/100).toFixed(2)} EUR.`,
     bookingUrl:null,accountBookingPath:`/?view=${audience==='customer'?'my-bookings':'supplier-bookings'}&booking=${encodeURIComponent(bookingId)}`}});
  }
 }
 return {onPaymentSettled:args=>queue('paid',args),onRefundSettled:args=>queue('refunded',args)};
}
