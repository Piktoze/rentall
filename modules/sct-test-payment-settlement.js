// Fail-closed atomic application of a previously reconciled SCT TEST payment.
// This module is NOT called by public routes or webhook handlers. The caller must
// independently retrieve current platform Stripe data using the TEST reconciler.
// Never use this function for LIVE payments, refunds or supplier transfers.
export function applyVerifiedSctTestPayment(db,{bookingId,verification,eventId}={}){
  if(!/^RB-[A-Za-z0-9-]+$/.test(bookingId||'') ||
     !/^evt_[A-Za-z0-9]+$/.test(eventId||'') ||
     verification?.ok!==true ||
     verification.bookingId!==bookingId ||
     !/^pi_[A-Za-z0-9]+$/.test(verification.paymentIntentId||'') ||
     !/^ch_[A-Za-z0-9]+$/.test(verification.chargeId||'') ||
     !Number.isSafeInteger(verification.amountCents) ||
     !Number.isSafeInteger(verification.feeCents) ||
     !Number.isSafeInteger(verification.supplierCents) ||
     verification.amountCents<50 || verification.feeCents<0 ||
     verification.supplierCents!==verification.amountCents-verification.feeCents)
    return {blocked:'invalid_test_reconciliation'};
  return db.transaction(()=>{
    const booking=db.prepare(`SELECT booking_id,listing_id,status,
      order_value,payment_status,stripe_payment_intent_id,stripe_refund_id,
      refund_status,payment_provider,payout_status FROM rental_bookings WHERE booking_id=?`)
      .get(bookingId);
    const binding=db.prepare(`SELECT booking_id,listing_id,amount_cents,fee_cents,
      payment_intent_id,stripe_mode FROM sct_booking_bindings WHERE booking_id=?`).get(bookingId);
    const inbox=db.prepare(`SELECT event_id,booking_id,payment_intent_id,amount_cents,status
      FROM sct_payment_reconciliation_inbox WHERE event_id=?`).get(eventId);
    if(!booking||!binding||!inbox || binding.stripe_mode!=='test' ||
       booking.booking_id!==binding.booking_id ||
       booking.listing_id!==binding.listing_id ||
       booking.status!=='confirmed' ||
       booking.stripe_refund_id ||
       (booking.refund_status && !['none','not_required'].includes(booking.refund_status)) ||
       !['unpaid','requires_payment_method','processing'].includes(booking.payment_status) ||
       booking.stripe_payment_intent_id!==verification.paymentIntentId ||
       binding.payment_intent_id!==verification.paymentIntentId ||
       binding.amount_cents!==verification.amountCents ||
       binding.fee_cents!==verification.feeCents ||
       Math.round(Number(booking.order_value||0)*100)!==verification.amountCents ||
       inbox.booking_id!==bookingId ||
       inbox.payment_intent_id!==verification.paymentIntentId ||
       inbox.amount_cents!==verification.amountCents ||
       inbox.status!=='reconciliation_required')
      return {blocked:'booking_or_evidence_binding_mismatch'};
    // Historical disputes are a hard block until they are independently resolved.
    const disputeTable=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='stripe_rental_disputes'").get();
    if(disputeTable && db.prepare('SELECT 1 FROM stripe_rental_disputes WHERE booking_id=? LIMIT 1').get(bookingId))
      return {blocked:'dispute_reconciliation_required'};
    const prior=db.prepare('SELECT booking_id FROM sct_payment_settlements WHERE booking_id=?').get(bookingId);
    if(prior)return {blocked:'payment_already_settled'};
    const updated=db.prepare(`UPDATE rental_bookings SET payment_status='paid',
      platform_fee_amount=?,supplier_amount=?,payment_provider='stripe',
      payout_status='not_ready',updated_at=CURRENT_TIMESTAMP
      WHERE booking_id=? AND status='confirmed' AND stripe_payment_intent_id=?
      AND payment_status IN ('unpaid','requires_payment_method','processing')
      AND stripe_refund_id IS NULL`).run(
        verification.feeCents/100,verification.supplierCents/100,
        bookingId,verification.paymentIntentId);
    if(updated.changes!==1)return {blocked:'concurrent_payment_state_change'};
    db.prepare(`INSERT INTO sct_payment_settlements
      (booking_id,event_id,payment_intent_id,charge_id,amount_cents,fee_cents,supplier_cents)
      VALUES (?,?,?,?,?,?,?)`).run(bookingId,eventId,verification.paymentIntentId,
        verification.chargeId,verification.amountCents,verification.feeCents,
        verification.supplierCents);
    // Inbox schema intentionally allows only reconciliation_required; settlement
    // is independently recorded in the unique payment_settlements table.
    return {status:'paid',bookingId,paymentIntentId:verification.paymentIntentId,
      chargeId:verification.chargeId,supplierCents:verification.supplierCents};
  }).immediate();
}
export function installSctPaymentSettlements(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS sct_payment_settlements (
      booking_id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      payment_intent_id TEXT NOT NULL UNIQUE,
      charge_id TEXT NOT NULL UNIQUE,
      amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
      fee_cents INTEGER NOT NULL CHECK(fee_cents>=0),
      supplier_cents INTEGER NOT NULL CHECK(supplier_cents>0),
      reconciled_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
