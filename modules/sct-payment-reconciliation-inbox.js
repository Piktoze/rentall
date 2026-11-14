// Persistent, fail-closed inbox for SCT payment-intent events in isolated TEST.
// No booking payment state, refund, payout, or transfer is modified here.
export function installSctPaymentReconciliationInbox(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS sct_payment_reconciliation_inbox (
      event_id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      payment_intent_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      currency TEXT NOT NULL CHECK(currency='eur'),
      event_created INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status='reconciliation_required'),
      received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS sct_payment_inbox_booking
      ON sct_payment_reconciliation_inbox(booking_id);
  `);
}
export function recordSctPaymentReconciliationSignal(db,event,booking){
  const pi=event?.data?.object;
  if(event?.type!=='payment_intent.succeeded' ||
     event?.livemode!==false || pi?.livemode!==false ||
     event?.account != null || !/^evt_[A-Za-z0-9]+$/.test(event.id||'') ||
     !Number.isSafeInteger(event.created) || event.created<=0 ||
     !/^pi_[A-Za-z0-9]+$/.test(pi?.id||'') ||
     pi?.status!=='succeeded' ||
     pi?.metadata?.paymentFlow!=='separate_charges_and_transfers' ||
     pi?.metadata?.purpose!=='rental_payment' ||
     !/^RB-[A-Za-z0-9-]+$/.test(pi?.metadata?.bookingId||'') ||
     !booking || booking.bookingId!==pi.metadata.bookingId ||
     booking.stripePaymentIntentId!==pi.id ||
     booking.listingId!==pi.metadata.listingId ||
     !Number.isSafeInteger(pi.amount) || pi.amount<=0 ||
     pi.amount!==pi.amount_received ||
     pi.amount!==Math.round(Number(booking.orderValue||0)*100) ||
     pi.currency!=='eur' ||
     pi.transfer_data!=null || pi.application_fee_amount!=null ||
     pi.on_behalf_of!=null)
    return {blocked:'unverified_sct_signal'};
  return db.transaction(()=>{
    const saved=db.prepare('SELECT * FROM sct_payment_reconciliation_inbox WHERE event_id=?').get(event.id);
    if(saved){
      if(saved.booking_id!==booking.bookingId ||
         saved.payment_intent_id!==pi.id || saved.amount_cents!==pi.amount ||
         saved.currency!==pi.currency || saved.event_created!==event.created)
        return {blocked:'event_identity_conflict'};
      return {status:'reconciliation_required',duplicate:true};
    }
    db.prepare(`INSERT INTO sct_payment_reconciliation_inbox
      (event_id,booking_id,payment_intent_id,amount_cents,currency,event_created,status)
      VALUES (?,?,?,?,?,?,'reconciliation_required')`)
      .run(event.id,booking.bookingId,pi.id,pi.amount,pi.currency,event.created);
    return {status:'reconciliation_required',duplicate:false};
  }).immediate();
}
