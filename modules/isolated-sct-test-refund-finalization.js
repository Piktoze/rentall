// TEST-only atomic booking + refund-journal settlement AFTER a verified Stripe
// refund readback. Never calls Stripe and is not exposed to public server routes.
// It deliberately blocks any transfer command, including pending/uncertain.
export function finalizeIsolatedSctTestRefund(db,{bookingId,refund}={}){
  if(!/^RB-[A-Za-z0-9-]+$/.test(bookingId||'')||
     !/^re_[A-Za-z0-9]+$/.test(refund?.id||'')||
     !/^pi_[A-Za-z0-9]+$/.test(refund?.payment_intent||'')||
     !/^ch_[A-Za-z0-9]+$/.test(refund?.charge||'')||
     refund.livemode!==false||refund.status!=='succeeded'||
     refund.currency!=='eur'||!Number.isSafeInteger(refund.amount)||
     refund.amount<50||
     refund.metadata?.bookingId!==bookingId||
     refund.metadata?.paymentIntentId!==refund.payment_intent||
     refund.metadata?.purpose!=='sct_rental_full_refund')
    return {blocked:'invalid_test_refund_proof'};
  if(!db?.transaction||!db?.prepare)return {blocked:'database_required'};
  return db.transaction(()=>{
    const command=db.prepare('SELECT * FROM sct_test_refund_commands WHERE booking_id=?').get(bookingId);
    const settled=db.prepare('SELECT * FROM sct_payment_settlements WHERE booking_id=?').get(bookingId);
    const bound=db.prepare('SELECT * FROM sct_booking_bindings WHERE booking_id=?').get(bookingId);
    const booking=db.prepare(`SELECT booking_id,listing_id,status,returned_at,
      payment_status,stripe_payment_intent_id,stripe_refund_id,refund_status,
      order_value,payout_status FROM rental_bookings WHERE booking_id=?`).get(bookingId);
    if(!command||!settled||!bound||!booking||
       command.status!=='reconcile_required'||command.stripe_refund_id!=null||
       bound.stripe_mode!=='test'||bound.booking_id!==bookingId||
       booking.booking_id!==bookingId||booking.listing_id!==bound.listing_id||
       booking.status!=='confirmed'||booking.returned_at!=null||
       booking.payment_status!=='paid'||booking.stripe_refund_id!=null||
       (booking.refund_status&&!['none','not_required'].includes(booking.refund_status))||
       !['not_ready','pending',null].includes(booking.payout_status)||
       Math.round(Number(booking.order_value||0)*100)!==refund.amount||
       command.amount_cents!==refund.amount||settled.amount_cents!==refund.amount||
       bound.amount_cents!==refund.amount||
       command.payment_intent_id!==refund.payment_intent||
       settled.payment_intent_id!==refund.payment_intent||
       bound.payment_intent_id!==refund.payment_intent||
       booking.stripe_payment_intent_id!==refund.payment_intent||
       command.charge_id!==refund.charge||settled.charge_id!==refund.charge)
      return {blocked:'booking_or_provider_refund_mismatch'};
    for(const table of ['supplier_transfer_commands','stripe_rental_disputes','rental_disputes']){
      const exists=db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if(exists&&db.prepare(`SELECT 1 FROM ${table} WHERE booking_id=? LIMIT 1`).get(bookingId))
        return {blocked:'outstanding_transfer_or_dispute'};
    }
    const result=db.prepare(`UPDATE rental_bookings SET payment_status='refunded',
      stripe_refund_id=?,refund_status='succeeded',refund_amount=?,
      payout_status='cancelled',payout_amount=0,updated_at=CURRENT_TIMESTAMP
      WHERE booking_id=? AND status='confirmed' AND payment_status='paid'
      AND stripe_refund_id IS NULL AND stripe_payment_intent_id=?`)
      .run(refund.id,refund.amount/100,bookingId,refund.payment_intent);
    if(result.changes!==1)return {blocked:'concurrent_booking_refund_change'};
    db.prepare(`UPDATE sct_test_refund_commands SET status='refunded',
      stripe_refund_id=?,updated_at=CURRENT_TIMESTAMP WHERE booking_id=?
      AND status='reconcile_required'`).run(refund.id,bookingId);
    return {status:'refunded',bookingId,refundId:refund.id,amountCents:refund.amount};
  }).immediate();
}
