import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installSctBookingBindings,getSctBookingBinding}
  from './modules/sct-booking-binding.js';
import {initiateIsolatedSctTestPayment}
  from './modules/isolated-sct-test-payment-coordinator.js';
import {makeIsolatedTestSctStripeAdapter}
  from './modules/isolated-test-sct-stripe-adapter.js';

const booking={
  id:'RB-coordinator-test',listingId:'listing-1',status:'confirmed',
  paymentStatus:'unpaid',paymentIntentId:null,
  paymentFlow:'separate_charges_and_transfers',livemode:false,
  amountCents:10000,feeCents:1500,destination:'acct_fixture',
  financialHold:false,listingApproved:true,supplierEligible:true,
};
function fixture({fail=false}={}){
  const db=new Database(':memory:');
  db.exec(`
    CREATE TABLE rental_bookings(
      booking_id TEXT PRIMARY KEY,listing_id TEXT NOT NULL,status TEXT NOT NULL,
      payment_status TEXT NOT NULL,stripe_payment_intent_id TEXT,stripe_refund_id TEXT,
      refund_status TEXT,order_value REAL NOT NULL,platform_fee_amount REAL,
      supplier_amount REAL,payment_provider TEXT,payout_status TEXT,updated_at TEXT);
    INSERT INTO rental_bookings
      (booking_id,listing_id,status,payment_status,order_value)
      VALUES('RB-coordinator-test','listing-1','confirmed','unpaid',100);
  `);
  installSctBookingBindings(db);
  let count=0;
  const pi={
    id:'pi_fixture',livemode:false,amount:10000,currency:'eur',
    capture_method:'automatic',status:'requires_payment_method',
    metadata:{bookingId:booking.id,listingId:booking.listingId,
      purpose:'rental_payment',paymentFlow:'separate_charges_and_transfers',
      supplierStripeAccountId:'acct_fixture',commissionCents:'1500'},
  };
  const stripe={
    paymentIntents:{
      create:async()=>{count++;if(fail)throw Error('transport unknown');return {...pi,client_secret:'test_secret'};},
      retrieve:async()=>pi,
    },
    transfers:{create:async()=>{throw Error('never called')},retrieve:async()=>null},
  };
  const adapter=makeIsolatedTestSctStripeAdapter({stripe,stripeMode:'test'});
  const initiate=(b=booking)=>initiateIsolatedSctTestPayment({db,booking:b,adapter});
  return {db,initiate,calls:()=>count};
}
test('one successful platform TEST intent is bound to one immutable booking',async()=>{
  const h=fixture();
  try{
    assert.deepEqual(await h.initiate(),{
      status:'requires_customer_payment',paymentIntentId:'pi_fixture',
      clientSecret:'test_secret',providerStatus:'requires_payment_method',
      bookingId:booking.id,
    });
    assert.equal(getSctBookingBinding(h.db,booking.id).paymentIntentId,'pi_fixture');
    const saved=h.db.prepare('SELECT * FROM rental_bookings WHERE booking_id=?').get(booking.id);
    assert.equal(saved.stripe_payment_intent_id,'pi_fixture');
    assert.equal(saved.payment_status,'requires_payment_method');
    assert.equal(saved.platform_fee_amount,15);
    assert.equal(saved.supplier_amount,85);
    assert.equal(saved.payout_status,'not_ready');
    assert.equal(h.calls(),1);
    assert.equal((await h.initiate()).blocked,'canonical_booking_not_ready');
    assert.equal(h.calls(),1);
  }finally{h.db.close()}
});
test('uncertain Stripe response is never automatically retried',async()=>{
  const h=fixture({fail:true});
  try{
    assert.equal((await h.initiate()).blocked,'payment_creation_requires_manual_reconciliation');
    assert.equal((await h.initiate()).blocked,'payment_creation_requires_manual_reconciliation');
    assert.equal(h.calls(),1);
    assert.equal(getSctBookingBinding(h.db,booking.id).paymentIntentId,null);
  }finally{h.db.close()}
});
test('concurrent callers cannot create two provider intents for one booking',async()=>{
  const h=fixture();
  try{
    const results=await Promise.all([h.initiate(),h.initiate()]);
    assert.equal(results.filter(x=>x.status==='requires_customer_payment').length,1);
    assert.equal(results.filter(x=>x.blocked==='payment_creation_requires_manual_reconciliation').length,1);
    assert.equal(h.calls(),1);
  }finally{h.db.close()}
});
test('unconfirmed, direct and LIVE bookings never call Stripe',async()=>{
  const h=fixture();
  try{
    for(const p of [{status:'pending'},{paymentFlow:'direct_charge'},{livemode:true},
      {financialHold:true},{listingApproved:false},{paymentStatus:'paid'}])
      assert.ok((await h.initiate({...booking,...p})).blocked);
    assert.equal(h.calls(),0);
  }finally{h.db.close()}
});
test('missing adapter cannot reserve a payment',async()=>{
  const db=new Database(':memory:');installSctBookingBindings(db);
  try{
    assert.equal((await initiateIsolatedSctTestPayment({db,booking})).blocked,
      'test_provider_adapter_required');
    assert.equal(getSctBookingBinding(db,booking.id),null);
  }finally{db.close()}
});

test('provider intent is not exposed if booking was cancelled during Stripe creation',async()=>{
  const h=fixture();
  try{
    const adapter={createPlatformPayment:async()=>{
      h.db.exec("UPDATE rental_bookings SET status='cancelled' WHERE booking_id='RB-coordinator-test'");
      return {paymentIntentId:'pi_fixture',clientSecret:'private_secret',status:'requires_payment_method'};
    }};
    assert.equal((await initiateIsolatedSctTestPayment({db:h.db,booking,adapter})).blocked,
      'booking_attachment_requires_manual_reconciliation');
    const saved=h.db.prepare('SELECT stripe_payment_intent_id FROM rental_bookings').get();
    assert.equal(saved.stripe_payment_intent_id,null);
    assert.equal(getSctBookingBinding(h.db,booking.id).paymentIntentId,'pi_fixture');
  }finally{h.db.close()}
});
test('legacy payment intent on booking cannot be overwritten by SCT',async()=>{
  const h=fixture();
  try{
    h.db.exec("UPDATE rental_bookings SET stripe_payment_intent_id='pi_legacy'");
    assert.equal((await h.initiate()).blocked,'canonical_booking_not_ready');
    assert.equal(h.calls(),0);
    assert.equal(h.db.prepare('SELECT stripe_payment_intent_id FROM rental_bookings').get()
      .stripe_payment_intent_id,'pi_legacy');
  }finally{h.db.close()}
});

test('canonical preflight refuses legacy, refunded, missing, or changed booking before Stripe',async()=>{
  for(const sql of [
    "UPDATE rental_bookings SET stripe_payment_intent_id='pi_legacy'",
    "UPDATE rental_bookings SET stripe_refund_id='re_prior'",
    "UPDATE rental_bookings SET payment_status='paid'",
    "UPDATE rental_bookings SET status='cancelled'",
    "UPDATE rental_bookings SET order_value=101",
    "UPDATE rental_bookings SET platform_fee_amount=15",
    "DELETE FROM rental_bookings",
  ]){
    const h=fixture();
    try {
      h.db.exec(sql);
      assert.equal((await h.initiate()).blocked,'canonical_booking_not_ready');
      assert.equal(h.calls(),0);
      assert.equal(getSctBookingBinding(h.db,booking.id),null);
    }finally{h.db.close()}
  }
});
test('canonical preflight refuses previously recorded Stripe disputes',async()=>{
  const h=fixture();
  try{
    h.db.exec(`CREATE TABLE stripe_rental_disputes(booking_id TEXT);
      INSERT INTO stripe_rental_disputes VALUES('RB-coordinator-test')`);
    assert.equal((await h.initiate()).blocked,'prior_financial_record_requires_review');
    assert.equal(h.calls(),0);
  }finally{h.db.close()}
});
