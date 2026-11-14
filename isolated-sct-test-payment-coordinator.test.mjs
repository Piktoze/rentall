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
  const db=new Database(':memory:');installSctBookingBindings(db);
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
    assert.equal(h.calls(),1);
    assert.equal((await h.initiate()).blocked,'payment_intent_already_bound');
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
