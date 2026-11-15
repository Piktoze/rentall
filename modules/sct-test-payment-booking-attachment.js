// Internal TEST-only bridge: attach one already-created SCT PaymentIntent to the
// original booking and immutable SCT binding atomically. Not a public API.
export function attachSctTestPaymentIntentToBooking(db,{bookingId,paymentIntentId}={}){
  if(!/^RB-[A-Za-z0-9-]+$/.test(bookingId||'')||
     !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId||''))return {blocked:'invalid_payment_identity'};
  return db.transaction(()=>{
    const row=db.prepare(`SELECT b.booking_id,b.listing_id,b.status,b.payment_status,
      b.stripe_payment_intent_id,b.stripe_refund_id,b.refund_status,b.order_value,
      s.listing_id AS sct_listing_id,s.amount_cents,s.fee_cents,
      s.payment_intent_id AS sct_payment_intent_id,s.stripe_mode
      FROM rental_bookings b JOIN sct_booking_bindings s ON s.booking_id=b.booking_id
      WHERE b.booking_id=?`).get(bookingId);
    if(!row||row.stripe_mode!=='test'||row.status!=='confirmed'||
       row.listing_id!==row.sct_listing_id||
       row.sct_payment_intent_id!==paymentIntentId||
       row.stripe_payment_intent_id!=null||
       row.stripe_refund_id!=null||
       (row.refund_status&&!['none','not_required'].includes(row.refund_status))||
       !['unpaid','requires_payment_method'].includes(row.payment_status)||
       Math.round(Number(row.order_value||0)*100)!==row.amount_cents||
       !Number.isSafeInteger(row.fee_cents)||row.fee_cents<0||
       row.fee_cents>=row.amount_cents)
      return {blocked:'booking_or_sct_identity_mismatch'};
    const changed=db.prepare(`UPDATE rental_bookings
      SET stripe_payment_intent_id=?,payment_status='requires_payment_method',
        platform_fee_amount=?,supplier_amount=?,payment_provider='stripe',
        payout_status='not_ready',updated_at=CURRENT_TIMESTAMP
      WHERE booking_id=? AND status='confirmed' AND stripe_payment_intent_id IS NULL
        AND stripe_refund_id IS NULL AND payment_status IN ('unpaid','requires_payment_method')`)
      .run(paymentIntentId,row.fee_cents/100,(row.amount_cents-row.fee_cents)/100,bookingId);
    return changed.changes===1
      ? {status:'attached',bookingId,paymentIntentId}
      : {blocked:'concurrent_booking_state_change'};
  }).immediate();
}
