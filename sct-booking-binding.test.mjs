import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installSctBookingBindings,reserveSctBookingBinding,bindSctPaymentIntent,getSctBookingBinding} from './modules/sct-booking-binding.js';
const booking={id:'RB-test-binding',listingId:'listing-1',amountCents:10000,feeCents:1500,destination:'acct_fixture',livemode:false};
function setup(){const db=new Database(':memory:');installSctBookingBindings(db);return db}
test('new EUR 100 booking reserves immutable 15 EUR fee and 85 EUR supplier portion',()=>{
  const db=setup();try{
    assert.deepEqual(reserveSctBookingBinding(db,booking),{status:'reserved',paymentIntentId:null,alreadyExists:false});
    assert.deepEqual(reserveSctBookingBinding(db,booking),{status:'reserved',paymentIntentId:null,alreadyExists:true});
    const stored=getSctBookingBinding(db,booking.id);
    assert.equal(stored.amountCents-stored.feeCents,8500);
    for(const patch of [{feeCents:1600},{amountCents:9900},{destination:'acct_other'},{listingId:'other'}])
      assert.equal(reserveSctBookingBinding(db,{...booking,...patch}).blocked,'immutable_booking_binding_conflict');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sct_booking_bindings').get().n,1);
  }finally{db.close()}
});
test('a booking binds one PaymentIntent and rejects swapped or reused intents',()=>{
  const db=setup();try{
    reserveSctBookingBinding(db,booking);
    assert.deepEqual(bindSctPaymentIntent(db,booking.id,'pi_fixture'),{status:'bound',alreadyExists:false});
    assert.deepEqual(bindSctPaymentIntent(db,booking.id,'pi_fixture'),{status:'bound',alreadyExists:true});
    assert.equal(bindSctPaymentIntent(db,booking.id,'pi_other').blocked,'payment_intent_identity_conflict');
    reserveSctBookingBinding(db,{...booking,id:'RB-other'});
    assert.equal(bindSctPaymentIntent(db,'RB-other','pi_fixture').blocked,'payment_intent_already_bound_to_another_booking');
    assert.equal(getSctBookingBinding(db,booking.id).paymentIntentId,'pi_fixture');
  }finally{db.close()}
});
test('LIVE and malformed amounts or Stripe identities are rejected',()=>{
  const db=setup();try{
    for(const patch of [{livemode:true},{amountCents:20},{feeCents:10000},{feeCents:-1},
       {destination:'bad'},{id:'A-legacy'},{listingId:'bad listing'}])
      assert.equal(reserveSctBookingBinding(db,{...booking,...patch}).blocked,'invalid_sct_booking_binding');
    assert.equal(bindSctPaymentIntent(db,booking.id,'pi_fixture').blocked,'sct_booking_not_reserved');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sct_booking_bindings').get().n,0);
  }finally{db.close()}
});
