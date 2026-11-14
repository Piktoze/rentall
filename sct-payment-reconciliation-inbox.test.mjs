import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {installSctPaymentReconciliationInbox,recordSctPaymentReconciliationSignal,recordBoundSctPaymentReconciliationSignal}
  from './modules/sct-payment-reconciliation-inbox.js';
const booking={bookingId:'RB-sct-inbox',listingId:'listing-1',stripePaymentIntentId:'pi_fixture',orderValue:100};
const event={
  id:'evt_fixture',type:'payment_intent.succeeded',livemode:false,created:1794700000,
  data:{object:{
    id:'pi_fixture',livemode:false,status:'succeeded',
    amount:10000,amount_received:10000,currency:'eur',
    metadata:{bookingId:booking.bookingId,listingId:booking.listingId,
      purpose:'rental_payment',paymentFlow:'separate_charges_and_transfers'},
  }},
};
function setup(){const db=new Database(':memory:');installSctPaymentReconciliationInbox(db);return db}
test('SCT signal records one pending reconciliation, not payment settlement',()=>{
  const db=setup();
  try{
    assert.deepEqual(recordSctPaymentReconciliationSignal(db,event,booking),
      {status:'reconciliation_required',duplicate:false});
    assert.deepEqual(recordSctPaymentReconciliationSignal(db,event,booking),
      {status:'reconciliation_required',duplicate:true});
    assert.equal(db.prepare('SELECT count(*) AS n FROM sct_payment_reconciliation_inbox').get().n,1);
    assert.equal(db.prepare('SELECT status FROM sct_payment_reconciliation_inbox').get().status,'reconciliation_required');
  }finally{db.close()}
});
test('altered identity on same evt is a conflict rather than a new booking',()=>{
  const db=setup();
  try{
    recordSctPaymentReconciliationSignal(db,event,booking);
    const other={...booking,orderValue:90};
    assert.equal(recordSctPaymentReconciliationSignal(db,event,other).blocked,'unverified_sct_signal');
    const changed={...event,data:{object:{...event.data.object,amount:9000,amount_received:9000}}};
    assert.equal(recordSctPaymentReconciliationSignal(db,changed,{...booking,orderValue:90}).blocked,
      'event_identity_conflict');
  }finally{db.close()}
});
test('connected account, LIVE, automatic transfer and unbound events are rejected',()=>{
  const db=setup();
  try{
    for(const mutated of [
      {...event,account:'acct_other'},
      {...event,livemode:true},
      {...event,type:'payment_intent.payment_failed'},
      {...event,data:{object:{...event.data.object,transfer_data:{destination:'acct_other'}}}},
      {...event,data:{object:{...event.data.object,metadata:{...event.data.object.metadata,bookingId:'RB-other'}}}},
      {...event,data:{object:{...event.data.object,amount_received:0}}},
    ])assert.equal(recordSctPaymentReconciliationSignal(db,mutated,booking).blocked,'unverified_sct_signal');
    assert.equal(db.prepare('SELECT count(*) AS n FROM sct_payment_reconciliation_inbox').get().n,0);
  }finally{db.close()}
});

test('bound SCT signal is durably queued and duplicate is not re-applied',()=>{
  const db=setup();
  const immutable={id:booking.bookingId,listingId:booking.listingId,
    amountCents:10000,feeCents:1500,destination:'acct_fixture',
    paymentIntentId:'pi_fixture',livemode:false};
  const fullEvent={...event,data:{object:{...event.data.object,
    metadata:{...event.data.object.metadata,supplierStripeAccountId:'acct_fixture',
      commissionCents:'1500'}}}};
  const actual={...booking,status:'confirmed',paymentStatus:'requires_payment_method',
    stripeRefundId:null};
  try{
    assert.deepEqual(recordBoundSctPaymentReconciliationSignal(db,fullEvent,actual,immutable),
      {status:'reconciliation_required',duplicate:false});
    assert.deepEqual(recordBoundSctPaymentReconciliationSignal(db,fullEvent,actual,immutable),
      {status:'reconciliation_required',duplicate:true});
    assert.equal(db.prepare('SELECT count(*) n FROM sct_payment_reconciliation_inbox').get().n,1);
    assert.equal(db.prepare('SELECT status FROM sct_payment_reconciliation_inbox').get().status,
      'reconciliation_required');
  }finally{db.close()}
});
test('SCT inbox refuses missing, substituted, refunded or unbound bookings',()=>{
  const db=setup();
  const binding={id:booking.bookingId,listingId:booking.listingId,
    amountCents:10000,feeCents:1500,destination:'acct_fixture',
    paymentIntentId:'pi_fixture',livemode:false};
  const fullEvent={...event,data:{object:{...event.data.object,
    metadata:{...event.data.object.metadata,supplierStripeAccountId:'acct_fixture',
      commissionCents:'1500'}}}};
  const actual={...booking,status:'confirmed',paymentStatus:'unpaid',stripeRefundId:null};
  try{
    for(const [b,immutable] of [
      [null,binding],[actual,null],[{...actual,status:'cancelled'},binding],
      [{...actual,paymentStatus:'paid'},binding],
      [{...actual,stripeRefundId:'re_fixture'},binding],
      [actual,{...binding,destination:'acct_other'}],
      [actual,{...binding,feeCents:1600}],
      [actual,{...binding,paymentIntentId:'pi_other'}],
    ])assert.equal(recordBoundSctPaymentReconciliationSignal(db,fullEvent,b,immutable).blocked,
      'immutable_sct_binding_mismatch');
    assert.equal(db.prepare('SELECT count(*) n FROM sct_payment_reconciliation_inbox').get().n,0);
  }finally{db.close()}
});
