// Preflight before ANY SCT TEST Stripe network call.
// This reads the canonical booking from SQLite, not user-supplied booking fields.
// Never mutate legacy bookings, SCT bindings, or payment provider state here.
export function preflightIsolatedSctTestCheckout(db,booking){
  if(booking?.livemode!==false || booking?.paymentFlow!=='separate_charges_and_transfers')
    return {blocked:'test_sct_only'};
  if(!db?.prepare)return {blocked:'database_required'};
  const id=booking?.id;
  if(!/^RB-[A-Za-z0-9-]+$/.test(id||'') ||
     !Number.isSafeInteger(booking?.amountCents) || booking.amountCents<50)
    return {blocked:'invalid_booking_identity'};
  const row=db.prepare(`SELECT booking_id,listing_id,status,payment_status,
      stripe_payment_intent_id,stripe_refund_id,refund_status,
      order_value,platform_fee_amount,supplier_amount,payout_status
    FROM rental_bookings WHERE booking_id=?`).get(id);
  if(!row || row.booking_id!==id || row.listing_id!==booking.listingId ||
     row.status!=='confirmed'|| row.payment_status!=='unpaid' ||
     row.stripe_payment_intent_id!=null || row.stripe_refund_id!=null ||
     (row.refund_status && !['none','not_required'].includes(row.refund_status)) ||
     Math.round(Number(row.order_value||0)*100)!==booking.amountCents ||
     (row.platform_fee_amount!=null && Number(row.platform_fee_amount)!==0) ||
     (row.supplier_amount!=null && Number(row.supplier_amount)!==0) ||
     (row.payout_status!=null && !['not_ready','pending'].includes(row.payout_status)))
    return {blocked:'canonical_booking_not_ready'};
  // A previously disputed or completed supplier transaction must not be
  // converted into a new platform payment.
  for(const [table,column] of [
    ['stripe_rental_disputes','booking_id'],
    ['sct_payment_settlements','booking_id'],
    ['supplier_transfer_commands','booking_id'],
  ]){
    if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table) &&
       db.prepare(`SELECT 1 FROM ${table} WHERE ${column}=? LIMIT 1`).get(id))
      return {blocked:'prior_financial_record_requires_review'};
  }
  return {ok:true,bookingId:id};
}
