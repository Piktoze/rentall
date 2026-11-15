import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installSctBookingBindings,reserveSctBookingBinding,bindSctPaymentIntent}
  from './modules/sct-booking-binding.js';
import {installSctPaymentReconciliationInbox,recordBoundSctPaymentReconciliationSignal}
  from './modules/sct-payment-reconciliation-inbox.js';
import {installSctPaymentSettlements}
  from './modules/sct-test-payment-settlement.js';
import {reconcileAndSettleIsolatedSctTestPayment}
  from './modules/isolated-sct-test-reconciliation-coordinator.js';

const bookingId='RB-coordinator-settlement',eventId='evt_fixture';
const binding={id:bookingId,listingId:'listing-1',amountCents:10000,
  feeCents:1500,destination:'acct_fixture',paymentIntentId:'pi_fixture',livemode:false};
const intent={id:'pi_fixture',livemode:false,status:'succeeded',currency:'eur',
  amount:10000,amount_received:10000,latest_charge:'ch_fixture',
  metadata:{bookingId,listingId:'listing-1',purpose:'rental_payment',
    paymentFlow:'separate_charges_and_transfers',supplierStripeAccountId:'acct_fixture',
    commissionCents:'1500'}};
const charge={id:'ch_fixture',payment_intent:'pi_fixture',livemode:false,status:'succeeded',
  currency:'eur',amount:10000,amount_captured:10000,amount_refunded:0,
  paid:true,captured:true,refunded:false,disputed:false};
const empty={has_more:false,data:[]};
function setup({stripePatch={}}={}){
  const db=new Database(':memory:');
  db.exec(`
    CREATE TABLE rental_bookings(booking_id TEXT PRIMARY KEY,listing_id TEXT,
      status TEXT,order_value REAL,payment_status TEXT,stripe_payment_intent_id TEXT,
      stripe_refund_id TEXT,refund_status TEXT,payment_provider TEXT,
      platform_fee_amount REAL,supplier_amount REAL,payout_status TEXT,updated_at TEXT);
    CREATE TABLE stripe_rental_disputes(booking_id TEXT NOT NULL);
    INSERT INTO rental_bookings
      (booking_id,listing_id,status,order_value,payment_status,stripe_payment_intent_id)
    VALUES('RB-coordinator-settlement','listing-1','confirmed',100,
      'requires_payment_method','pi_fixture');
  `);
  installSctBookingBindings(db);
  installSctPaymentReconciliationInbox(db);
  installSctPaymentSettlements(db);
  reserveSctBookingBinding(db,binding);
  bindSctPaymentIntent(db,bookingId,'pi_fixture');
  const event={id:eventId,type:'payment_intent.succeeded',livemode:false,created:1794700000,
    data:{object:{...intent}}};
  const booking={bookingId,listingId:'listing-1',status:'confirmed',
    paymentStatus:'requires_payment_method',stripePaymentIntentId:'pi_fixture',
    orderValue:100,stripeRefundId:null};
  assert.equal(recordBoundSctPaymentReconciliationSignal(db,event,booking,binding).status,
    'reconciliation_required');
  let count=0;
  const stripe={
    paymentIntents:{retrieve:async()=>{count++;return stripePatch.intent||intent}},
    charges:{retrieve:async()=>stripePatch.charge||charge},
    refunds:{list:async()=>stripePatch.refunds||empty},
    disputes:{list:async()=>stripePatch.disputes||empty},
    transfers:{list:async()=>stripePatch.transfers||empty},
  };
  const reconcile=(args={})=>reconcileAndSettleIsolatedSctTestPayment({
    db,stripe,stripeMode:'test',bookingId,eventId,...args,
  });
  return {db,stripe,reconcile,count:()=>count};
}
test('fresh Stripe TEST proof atomically updates paid status, but never supplier payout',async()=>{
  const x=setup();
  try{
    assert.deepEqual(await x.reconcile(),{status:'paid',bookingId,paymentIntentId:'pi_fixture',
      chargeId:'ch_fixture',supplierCents:8500});
    const b=x.db.prepare('SELECT * FROM rental_bookings').get();
    assert.equal(b.payment_status,'paid');
    assert.equal(b.platform_fee_amount,15);
    assert.equal(b.supplier_amount,85);
    assert.equal(b.payout_status,'not_ready');
    assert.equal(x.db.prepare('SELECT count(*) n FROM sct_payment_settlements').get().n,1);
    assert.equal((await x.reconcile()).blocked,'booking_not_ready_for_test_reconciliation');
    assert.equal(x.count(),1);
  }finally{x.db.close()}
});
test('no Stripe read is attempted for an expired or cancelled booking',async()=>{
  const x=setup();
  try{
    x.db.exec("UPDATE rental_bookings SET status='cancelled'");
    assert.equal((await x.reconcile()).blocked,'booking_not_ready_for_test_reconciliation');
    assert.equal(x.count(),0);
  }finally{x.db.close()}
});
test('dispute, refund and existing transfer cannot settle booking',async()=>{
  for(const patch of [
    {charge:{...charge,disputed:true}},
    {refunds:{data:[{id:'re_fixture'}],has_more:false}},
    {transfers:{data:[{id:'tr_fixture'}],has_more:false}},
  ]){
    const x=setup({stripePatch:patch});
    try{
      assert.ok((await x.reconcile()).blocked);
      assert.equal(x.db.prepare('SELECT payment_status FROM rental_bookings').get().payment_status,
        'requires_payment_method');
      assert.equal(x.db.prepare('SELECT count(*) n FROM sct_payment_settlements').get().n,0);
    }finally{x.db.close()}
  }
});
test('provider failure, LIVE mode and wrong inbox event never settle',async()=>{
  const x=setup();
  try{
    assert.equal((await x.reconcile({stripeMode:'live'})).blocked,'test_only');
    assert.equal((await x.reconcile({eventId:'evt_other'})).blocked,
      'booking_not_ready_for_test_reconciliation');
    assert.equal((await x.reconcile({stripe:{paymentIntents:{retrieve:async()=>{throw Error('offline')}},
      charges:x.stripe.charges,refunds:x.stripe.refunds,disputes:x.stripe.disputes,
      transfers:x.stripe.transfers}})).blocked,'provider_reconciliation_unavailable');
    assert.equal(x.db.prepare('SELECT payment_status FROM rental_bookings').get().payment_status,
      'requires_payment_method');
  }finally{x.db.close()}
});
test('booking state changed while Stripe is being read is rejected inside transaction',async()=>{
  const x=setup();
  try{
    const stripe={...x.stripe,paymentIntents:{retrieve:async()=>{
      x.db.exec("UPDATE rental_bookings SET status='cancelled'");
      return intent;
    }}};
    assert.equal((await x.reconcile({stripe})).blocked,'booking_or_evidence_binding_mismatch');
    assert.equal(x.db.prepare('SELECT count(*) n FROM sct_payment_settlements').get().n,0);
  }finally{x.db.close()}
});
