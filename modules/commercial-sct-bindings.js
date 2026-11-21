// Immutable commercial LIVE binding, in a distinct namespace. No legacy migrations.
// This module never changes legacy rental_bookings or sends funds to Stripe.
export function installCommercialBindings(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS commercial_sct_bindings (
      booking_id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK(amount_cents >= 50),
      fee_cents INTEGER NOT NULL CHECK(fee_cents >= 0 AND fee_cents < amount_cents),
      currency TEXT NOT NULL CHECK(currency = 'eur'),
      destination TEXT NOT NULL,
      platform_account TEXT NOT NULL,
      stripe_mode TEXT NOT NULL CHECK(stripe_mode = 'live'),
      payment_intent_id TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
const validId = x => typeof x==='string' && /^RB-[A-Za-z0-9-]+$/.test(x);
const validStripeId = (x,prefix) => typeof x==='string' && new RegExp('^'+prefix+'[A-Za-z0-9]+$').test(x);
export function reserveCommercialBinding(db, booking) {
  const {id,listingId,amountCents,feeCents,destination,platformAccount,livemode}=booking||{};
  if(!validStripeId(platformAccount,'acct_') || livemode!==true || !validId(id) || !/^[A-Za-z0-9-]+$/.test(listingId||'') ||
     !Number.isSafeInteger(amountCents) || amountCents<50 ||
     !Number.isSafeInteger(feeCents) || feeCents!==Math.round(amountCents*0.15) || feeCents>=amountCents || destination===platformAccount ||
     !validStripeId(destination,'acct_')) return {blocked:'invalid_sct_booking_binding'};
  return db.transaction(()=>{
    const current=db.prepare('SELECT * FROM commercial_sct_bindings WHERE booking_id=?').get(id);
    if(current) {
      if(current.listing_id!==listingId || current.amount_cents!==amountCents ||
        current.fee_cents!==feeCents || current.destination!==destination ||
        current.platform_account!==platformAccount || current.currency!=='eur' || current.stripe_mode!=='live')
        return {blocked:'immutable_booking_binding_conflict'};
      return {status:'reserved',paymentIntentId:current.payment_intent_id||null,alreadyExists:true};
    }
    // This is additive only: the caller must have independently verified that
    // the booking exists, is confirmed/unpaid and is eligible for SCT.
    db.prepare(`INSERT INTO commercial_sct_bindings
      (booking_id,listing_id,amount_cents,fee_cents,currency,destination,platform_account,stripe_mode)
      VALUES (?,?,?,?,? ,?,?,'live')`).run(id,listingId,amountCents,feeCents,'eur',destination,platformAccount);
    return {status:'reserved',paymentIntentId:null,alreadyExists:false};
  }).immediate();
}
export function bindCommercialPaymentIntent(db, bookingId, paymentIntentId) {
  if(!validId(bookingId) || !validStripeId(paymentIntentId,'pi_'))
    return {blocked:'invalid_payment_intent_binding'};
  return db.transaction(()=>{
    const row=db.prepare('SELECT payment_intent_id FROM commercial_sct_bindings WHERE booking_id=?').get(bookingId);
    if(!row)return {blocked:'sct_booking_not_reserved'};
    if(row.payment_intent_id)
      return row.payment_intent_id===paymentIntentId ?
        {status:'bound',alreadyExists:true}:{blocked:'payment_intent_identity_conflict'};
    try {
      const changed=db.prepare(`UPDATE commercial_sct_bindings SET payment_intent_id=?
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
export function getCommercialBinding(db, bookingId) {
  const row=db.prepare('SELECT * FROM commercial_sct_bindings WHERE booking_id=?').get(bookingId);
  if(!row)return null;
  return {id:row.booking_id,listingId:row.listing_id,amountCents:row.amount_cents,
    feeCents:row.fee_cents,destination:row.destination,platformAccount:row.platform_account,livemode:true,
    paymentIntentId:row.payment_intent_id};
}
