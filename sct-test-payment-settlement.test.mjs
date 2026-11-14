import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installSctBookingBindings, reserveSctBookingBinding, bindSctPaymentIntent}
  from './modules/sct-booking-binding.js';
import {installSctPaymentReconciliationInbox,recordBoundSctPaymentReconciliationSignal}
  from './modules/sct-payment-reconciliation-inbox.js';
import {installSctPaymentSettlements,applyVerifiedSctTestPayment}
  from './modules/sct-test-payment-settlement.js';

const bookingId='RB-isolated-settlement';
const eventId='evt_fixture';
const verification={ok:true,bookingId,paymentIntentId:'pi_fixture',chargeId:'ch_fixture',
  amountCents:10000,feeCents:1500,supplierCents:8500};
function fixture(){
  const db=new Database(':memory:');
  db.exec(`
    CREATE TABLE rental_bookings(
      booking_id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, status TEXT NOT NULL,
      order_value REAL NOT NULL,payment_status TEXT NOT NULL,
      stripe_payment_intent_id TEXT, stripe_refund_id TEXT,refund_status TEXT,
      payment_provider TEXT,platform_fee_amount REAL,supplier_amount REAL,
      payout_status TEXT,updated_at TEXT
    );
    CREATE TABLE stripe_rental_disputes(booking_id TEXT NOT NULL);
    INSERT INTO rental_bookings
      (booking_id,listing_id,status,order_value,payment_status,stripe_payment_intent_id)
      VALUES ('RB-isolated-settlement','listing-1','confirmed',100,'requires_payment_method','pi_fixture');
  `);
  installSctBookingBindings(db);
  installSctPaymentReconciliationInbox(db);
  installSctPaymentSettlements(db);
  const b={id:bookingId,listingId:'listing-1',amountCents:10000,feeCents:1500,
    destination:'acct_fixture',livemode:false};
  reserveSctBookingBinding(db,b);
  bindSctPaymentIntent(db,bookingId,'pi_fixture');
  const booking={bookingId,listingId:'listing-1',status:'confirmed',paymentStatus:'requires_payment_method',
    orderValue:100,stripePaymentIntentId:'pi_fixture',stripeRefundId:null};
  const event={id:eventId,type:'payment_intent.succeeded',livemode:false,created:1794700000,
    data:{object:{id:'pi_fixture',status:'succeeded',livemode:false,
      amount:10000,amount_received:10000,currency:'eur',
      metadata:{bookingId,listingId:'listing-1',purpose:'rental_payment',
        paymentFlow:'separate_charges_and_transfers',supplierStripeAccountId:'acct_fixture',
        commissionCents:'1500'}}}};
  assert.equal(recordBoundSctPaymentReconciliationSignal(db,event,booking,
    {...b,paymentIntentId:'pi_fixture'}).status,'reconciliation_required');
  return db;
}
const settle=db=>applyVerifiedSctTestPayment(db,{bookingId,verification,eventId});
test('single transaction marks paid with exact 15/85 split, without supplier payout',()=>{
  const db=fixture();try{
    assert.deepEqual(settle(db),{status:'paid',bookingId,paymentIntentId:'pi_fixture',
      chargeId:'ch_fixture',supplierCents:8500});
    const r=db.prepare('SELECT * FROM rental_bookings').get();
    assert.equal(r.payment_status,'paid');
    assert.equal(r.platform_fee_amount,15);
    assert.equal(r.supplier_amount,85);
    assert.equal(r.payout_status,'not_ready');
    assert.equal(db.prepare('SELECT count(*) AS n FROM sct_payment_settlements').get().n,1);
    assert.equal(settle(db).blocked,'booking_or_evidence_binding_mismatch');
  }finally{db.close()}
});
test('wrong amount, charge or fee proof never settles',()=>{
  for(const patch of [{amountCents:9999},{supplierCents:8600},{chargeId:'invalid'}]){
    const db=fixture();try{
      assert.ok(applyVerifiedSctTestPayment(db,{bookingId,eventId,
        verification:{...verification,...patch}}).blocked);
      assert.equal(db.prepare('SELECT payment_status FROM rental_bookings').get().payment_status,
        'requires_payment_method');
      assert.equal(db.prepare('SELECT count(*) AS n FROM sct_payment_settlements').get().n,0);
    }finally{db.close()}
  }
});
test('cancelled, refunded, disputed and already-paid bookings are blocked atomically',()=>{
  for(const [sql,expected] of [
    ["UPDATE rental_bookings SET status='cancelled'","booking_or_evidence_binding_mismatch"],
    ["UPDATE rental_bookings SET stripe_refund_id='re_fixture'","booking_or_evidence_binding_mismatch"],
    ["UPDATE rental_bookings SET payment_status='paid'","booking_or_evidence_binding_mismatch"],
    ["INSERT INTO stripe_rental_disputes VALUES ('RB-isolated-settlement')","dispute_reconciliation_required"]
  ]){
    const db=fixture();try{
      db.exec(sql);assert.equal(settle(db).blocked,expected);
      assert.equal(db.prepare('SELECT count(*) AS n FROM sct_payment_settlements').get().n,0);
    }finally{db.close()}
  }
});
test('unrecorded webhook and swapped immutable payment identity fail closed',()=>{
  const db=fixture();try{
    assert.equal(applyVerifiedSctTestPayment(db,{bookingId,eventId:'evt_other',verification}).blocked,
      'booking_or_evidence_binding_mismatch');
    db.exec("UPDATE sct_booking_bindings SET payment_intent_id='pi_other'");
    assert.equal(settle(db).blocked,'booking_or_evidence_binding_mismatch');
    assert.equal(db.prepare('SELECT count(*) AS n FROM sct_payment_settlements').get().n,0);
  }finally{db.close()}
});
