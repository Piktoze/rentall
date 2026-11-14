// Immutable SCT booking/payment snapshot for an opt-in future TEST checkout.
// This module never changes legacy rental_bookings or sends funds to Stripe.
export function installSctBookingBindings(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sct_booking_bindings (
      booking_id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK(amount_cents >= 50),
      fee_cents INTEGER NOT NULL CHECK(fee_cents >= 0 AND fee_cents < amount_cents),
      currency TEXT NOT NULL CHECK(currency = 'eur'),
      destination TEXT NOT NULL,
      stripe_mode TEXT NOT NULL CHECK(stripe_mode = 'test'),
      payment_intent_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
const validId = x => typeof x==='string' && /^RB-[A-Za-z0-9-]+$/.test(x);
const validStripeId = (x,prefix) => typeof x==='string' && new RegExp('^'+prefix+'[A-Za-z0-9]+$').test(x);
export function reserveSctBookingBinding(db, booking) {
  const {id,listingId,amountCents,feeCents,destination,livemode}=booking||{};
  if(livemode!==false || !validId(id) || !/^[A-Za-z0-9-]+$/.test(listingId||'') ||
     !Number.isSafeInteger(amountCents) || amountCents<50 ||
     !Number.isSafeInteger(feeCents) || feeCents<0 || feeCents>=amountCents ||
     !validStripeId(destination,'acct_')) return {blocked:'invalid_sct_booking_binding'};
  return db.transaction(()=>{
    const current=db.prepare('SELECT * FROM sct_booking_bindings WHERE booking_id=?').get(id);
    if(current) {
      if(current.listing_id!==listingId || current.amount_cents!==amountCents ||
        current.fee_cents!==feeCents || current.destination!==destination ||
        current.currency!=='eur' || current.stripe_mode!=='test')
        return {blocked:'immutable_booking_binding_conflict'};
      return {status:'reserved',paymentIntentId:current.payment_intent_id||null,alreadyExists:true};
    }
    // This is additive only: the caller must have independently verified that
    // the booking exists, is confirmed/unpaid and is eligible for SCT.
    db.prepare(`INSERT INTO sct_booking_bindings
      (booking_id,listing_id,amount_cents,fee_cents,currency,destination,stripe_mode)
      VALUES (?,?,?,?,? ,?,'test')`).run(id,listingId,amountCents,feeCents,'eur',destination);
    return {status:'reserved',paymentIntentId:null,alreadyExists:false};
  }).immediate();
}
export function bindSctPaymentIntent(db, bookingId, paymentIntentId) {
  if(!validId(bookingId) || !validStripeId(paymentIntentId,'pi_'))
    return {blocked:'invalid_payment_intent_binding'};
  return db.transaction(()=>{
    const row=db.prepare('SELECT payment_intent_id FROM sct_booking_bindings WHERE booking_id=?').get(bookingId);
    if(!row)return {blocked:'sct_booking_not_reserved'};
    if(row.payment_intent_id)
      return row.payment_intent_id===paymentIntentId ?
        {status:'bound',alreadyExists:true}:{blocked:'payment_intent_identity_conflict'};
    try {
      const changed=db.prepare(`UPDATE sct_booking_bindings SET payment_intent_id=?
        WHERE booking_id=? AND payment_intent_id IS NULL`).run(paymentIntentId,bookingId).changes;
      if(changed!==1)return {blocked:'payment_intent_binding_race'};
    } catch(error) {
      if(String(error.code||'').startsWith('SQLITE_CONSTRAINT'))
        return {blocked:'payment_intent_already_bound_to_another_booking'};
      throw error;
    }
    return {status:'bound',alreadyExists:false};
  }).immediate();
}
export function getSctBookingBinding(db, bookingId) {
  const row=db.prepare('SELECT * FROM sct_booking_bindings WHERE booking_id=?').get(bookingId);
  if(!row)return null;
  return {id:row.booking_id,listingId:row.listing_id,amountCents:row.amount_cents,
    feeCents:row.fee_cents,destination:row.destination,livemode:false,
    paymentIntentId:row.payment_intent_id};
}
