// Financial disputes are independent of physical rental and refund status.
export function installStripeRentalDisputes(db){
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_rental_disputes (
      dispute_id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL REFERENCES rental_bookings(booking_id),
      stripe_account TEXT NOT NULL,
      payment_intent_id TEXT NOT NULL,
      charge_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL,
      provider_status TEXT NOT NULL,
      event_id TEXT NOT NULL,
      event_created INTEGER NOT NULL,
      event_rank INTEGER NOT NULL,
      closed INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stripe_rental_disputes_booking ON stripe_rental_disputes(booking_id);
  `);
}

const eventRank={'charge.dispute.created':1,'charge.dispute.updated':2,'charge.dispute.closed':3};
const terminal=new Set(['won','lost','warning_closed','prevented']);
const objectId=value=>typeof value==='string'?value:value?.id;

export function recordStripeRentalDispute(db,event,{getBooking,accountForBooking}){
  const dispute=event.data?.object;
  const intent=objectId(dispute?.payment_intent);
  const charge=objectId(dispute?.charge);
  const rank=eventRank[event.type];
  if(!rank||!event.account||!dispute?.id?.startsWith('dp_')||!intent?.startsWith('pi_')||
     !charge?.startsWith('ch_')||!Number.isSafeInteger(event.created)||event.created<=0||
     typeof dispute.status!=='string'||!dispute.status||!Number.isSafeInteger(dispute.amount)||
     dispute.amount<=0||dispute.currency!=='eur')return 'invalid';

  const matches=db.prepare(`SELECT booking_id FROM rental_bookings
    WHERE stripe_payment_intent_id=? OR security_deposit_payment_intent_id=? LIMIT 2`).all(intent,intent);
  if(matches.length!==1)return matches.length?'ambiguous':'unmatched';
  const booking=getBooking(matches[0].booking_id);
  if(!booking||accountForBooking(booking)!==event.account)return 'account_mismatch';
  const maximum=booking.stripePaymentIntentId===intent?booking.orderValue:booking.securityDepositAmount;
  if(dispute.amount>Math.round(Number(maximum||0)*100))return 'amount_mismatch';

  return db.transaction(()=>{
    const prior=db.prepare('SELECT * FROM stripe_rental_disputes WHERE dispute_id=?').get(dispute.id);
    if(prior && (prior.stripe_account!==event.account||prior.payment_intent_id!==intent||
      prior.charge_id!==charge||prior.booking_id!==booking.bookingId))return 'identity_mismatch';
    const closed=rank===3||terminal.has(dispute.status)?1:0;
    if(prior && (prior.event_id===event.id || (prior.closed&&!closed) ||
      (prior.closed===closed && (event.created<prior.event_created ||
        (event.created===prior.event_created && rank<=prior.event_rank)))))return 'stale';

    db.prepare(`INSERT INTO stripe_rental_disputes
      (dispute_id,booking_id,stripe_account,payment_intent_id,charge_id,amount_cents,currency,
       provider_status,event_id,event_created,event_rank,closed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(dispute_id) DO UPDATE SET amount_cents=excluded.amount_cents,
        provider_status=excluded.provider_status,event_id=excluded.event_id,
        event_created=excluded.event_created,event_rank=excluded.event_rank,closed=excluded.closed`)
      .run(dispute.id,booking.bookingId,event.account,intent,charge,dispute.amount,
        dispute.currency,dispute.status,event.id,event.created,rank,closed);
    return 'recorded';
  }).immediate();
}

export function hasStripeRentalDisputeHold(db,bookingId){
  // Even won/closed disputes require independent ledger reconciliation.
  return !!db.prepare('SELECT 1 FROM stripe_rental_disputes WHERE booking_id=? LIMIT 1').get(bookingId);
}
