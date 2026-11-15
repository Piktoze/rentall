import assert from 'node:assert/strict';
import {test} from 'node:test';
import Database from 'better-sqlite3';
import {makeIsolatedSctTestRefundAdapter} from './modules/isolated-sct-test-refund-adapter.js';
import {executeIsolatedSctTestFullRefund} from './modules/isolated-sct-test-refund-executor.js';
import {installIsolatedSctRefundCommands} from './modules/isolated-sct-test-refund-journal.js';

const booking={id:'RB-test-refund-exec',status:'confirmed',paymentStatus:'paid',
  livemode:false,paymentFlow:'separate_charges_and_transfers',
  handedOverAt:null,returnedAt:null,financialHold:false,disputeHold:false,
  stripeRefundId:null,refundStatus:null,transferCommandExists:false};
const binding={id:booking.id,livemode:false,paymentIntentId:'pi_fixture',amountCents:10000,feeCents:1500};
const settlement={bookingId:booking.id,paymentIntentId:'pi_fixture',chargeId:'ch_fixture',
  amountCents:10000,feeCents:1500,supplierCents:8500};
const provider={livemode:false,paymentIntentId:'pi_fixture',chargeId:'ch_fixture',
  amountCents:10000,currency:'eur',paymentStatus:'succeeded',chargeCaptured:true,
  chargeDisputed:false,amountRefundedCents:0,refundsComplete:true,refundCount:0,
  disputesComplete:true,disputeCount:0,transfersComplete:true,transferCount:0,
  stripeTransfersComplete:true,stripeTransferCount:0};
const refund={id:'re_fixture',status:'succeeded',livemode:false,charge:'ch_fixture',
  payment_intent:'pi_fixture',amount:10000,currency:'eur',
  metadata:{bookingId:booking.id,paymentIntentId:'pi_fixture',purpose:'sct_rental_full_refund'}};
function fixture({createFails=false,readbackFails=false,readback=refund}={}){
  const db=new Database(':memory:');
  db.exec(`CREATE TABLE sct_payment_settlements
    (booking_id TEXT PRIMARY KEY,payment_intent_id TEXT,charge_id TEXT,amount_cents INTEGER);
    INSERT INTO sct_payment_settlements VALUES
    ('RB-test-refund-exec','pi_fixture','ch_fixture',10000);
    CREATE TABLE sct_booking_bindings(
      booking_id TEXT PRIMARY KEY,listing_id TEXT,payment_intent_id TEXT,
      stripe_mode TEXT,amount_cents INTEGER);
    INSERT INTO sct_booking_bindings VALUES
      ('RB-test-refund-exec','listing-1','pi_fixture','test',10000);
    CREATE TABLE rental_bookings(
      booking_id TEXT PRIMARY KEY,listing_id TEXT,status TEXT,returned_at TEXT,
      payment_status TEXT,stripe_payment_intent_id TEXT,stripe_refund_id TEXT,
      refund_status TEXT,order_value REAL,payout_status TEXT,refund_amount REAL,
      payout_amount REAL,updated_at TEXT);
    INSERT INTO rental_bookings
      (booking_id,listing_id,status,payment_status,stripe_payment_intent_id,
       order_value,payout_status) VALUES
      ('RB-test-refund-exec','listing-1','confirmed','paid','pi_fixture',100,'not_ready');`);
  installIsolatedSctRefundCommands(db);
  let creates=0,retrieves=0;
  const calls=[];
  const stripe={_apiKey:'sk_test_fixture0123456789',refunds:{
    create:async(payload,options)=>{
      creates++;calls.push({payload,options});
      if(createFails)throw new Error('timeout');
      return {id:'re_fixture'};
    },
    retrieve:async(id)=>{
      retrieves++;if(readbackFails)throw new Error('timeout');
      return readback;
    },
  }};
  const adapter=makeIsolatedSctTestRefundAdapter({stripe,stripeMode:'test',
    stripeSecretKey:'sk_test_fixture0123456789'});
  const execute=(changes={})=>executeIsolatedSctTestFullRefund({
    db,booking,binding,settlement,provider,adapter,...changes,
  });
  return {db,execute,calls,creates:()=>creates,retrieves:()=>retrieves};
}
test('platform TEST refund succeeds with provider readback and only one network attempt',async()=>{
  const x=fixture();
  try{
    assert.deepEqual(await x.execute(),{status:'refunded',bookingId:booking.id,refundId:'re_fixture',amountCents:10000});
    assert.deepEqual(x.db.prepare('SELECT payment_status,stripe_refund_id,refund_amount,payout_status FROM rental_bookings').get(),{
      payment_status:'refunded',stripe_refund_id:'re_fixture',refund_amount:100,payout_status:'cancelled',
    });
    assert.equal(x.creates(),1);assert.equal(x.retrieves(),1);
    assert.equal(x.calls[0].payload.amount,10000);
    assert.equal(x.calls[0].payload.charge,'ch_fixture');
    assert.equal(x.calls[0].options.idempotencyKey,'booking:RB-test-refund-exec:sct-full-refund:v1');
    assert.equal(x.calls[0].options.stripeAccount,undefined);
    assert.equal((await x.execute()).blocked,'existing_refund_command_requires_reconciliation');
    assert.equal(x.creates(),1);
    assert.deepEqual(x.db.prepare('SELECT status,stripe_refund_id FROM sct_test_refund_commands').get(),
      {status:'refunded',stripe_refund_id:'re_fixture'});
  }finally{x.db.close()}
});
test('unknown Stripe result and readback timeout stay reconcile_required and never retry',async()=>{
  for(const config of [{createFails:true},{readbackFails:true}]){
    const x=fixture(config);
    try{
      assert.equal((await x.execute()).blocked,'provider_refund_result_unknown');
      assert.equal((await x.execute()).blocked,'existing_refund_command_requires_reconciliation');
      assert.equal(x.creates(),1);
      assert.equal(x.db.prepare('SELECT status FROM sct_test_refund_commands').get().status,
        'reconcile_required');
    }finally{x.db.close()}
  }
});
test('changed refund identity, amount or metadata fails closed without marking refunded',async()=>{
  for(const changed of [
    {amount:9900},{charge:'ch_other'},{livemode:true},
    {metadata:{...refund.metadata,bookingId:'RB-other'}},
    {status:'pending'},
  ]){
    const x=fixture({readback:{...refund,...changed}});
    try{
      assert.equal((await x.execute()).blocked,'refund_reconciliation_required');
      assert.equal(x.db.prepare('SELECT status FROM sct_test_refund_commands').get().status,
        'reconcile_required');
    }finally{x.db.close()}
  }
});
test('full refund is blocked before network by dispute, supplier transfer or LIVE booking',async()=>{
  const x=fixture();
  try{
    for(const changes of [
      {booking:{...booking,livemode:true}},
      {booking:{...booking,transferCommandExists:true}},
      {booking:{...booking,disputeHold:true}},
      {provider:{...provider,refundCount:1}},
    ])assert.ok((await x.execute(changes)).blocked);
    assert.equal(x.creates(),0);
  }finally{x.db.close()}
});
test('Stripe LIVE key or mismatched key is rejected before any write',()=>{
  const stripe={_apiKey:'sk_live_not_real',refunds:{create:async()=>{},retrieve:async()=>{}}};
  assert.equal(makeIsolatedSctTestRefundAdapter({stripe,stripeMode:'test',
    stripeSecretKey:'sk_live_not_real'}).blocked,'trusted_platform_test_stripe_client_required');
  assert.equal(makeIsolatedSctTestRefundAdapter({stripe,stripeMode:'test',
    stripeSecretKey:'sk_test_fixture0123456789'}).blocked,'trusted_platform_test_stripe_client_required');
  assert.equal(makeIsolatedSctTestRefundAdapter({stripe,stripeMode:'live',
    stripeSecretKey:'sk_test_fixture0123456789'}).blocked,'trusted_platform_test_stripe_client_required');
  const noInspectableKey={refunds:stripe.refunds};
  assert.equal(makeIsolatedSctTestRefundAdapter({stripe:noInspectableKey,stripeMode:'test',
    stripeSecretKey:'sk_test_fixture0123456789'}).blocked,'trusted_platform_test_stripe_client_required');
});

test('historical dispute blocks atomic refund booking update after Stripe succeeded',async()=>{
  const x=fixture();
  try{
    x.db.exec(`CREATE TABLE stripe_rental_disputes(booking_id TEXT);
      INSERT INTO stripe_rental_disputes VALUES('RB-test-refund-exec');`);
    assert.equal((await x.execute()).blocked,'refund_booking_reconciliation_required');
    assert.equal(x.db.prepare('SELECT payment_status FROM rental_bookings').get().payment_status,'paid');
    assert.equal(x.db.prepare('SELECT status FROM sct_test_refund_commands').get().status,'reconcile_required');
    assert.equal(x.creates(),1);
    assert.equal((await x.execute()).blocked,'existing_refund_command_requires_reconciliation');
    assert.equal(x.creates(),1);
  }finally{x.db.close()}
});
test('cancellation during provider refund causes explicit reconciliation, not false payout release',async()=>{
  const x=fixture();
  try{
    const adapter={
      createRefund:async()=>({refundId:'re_fixture'}),
      retrieveRefund:async()=>{
        x.db.exec("UPDATE rental_bookings SET status='cancelled'");
        return refund;
      },
    };
    assert.equal((await x.execute({adapter})).blocked,'refund_booking_reconciliation_required');
    assert.equal(x.db.prepare('SELECT payment_status FROM rental_bookings').get().payment_status,'paid');
    assert.equal(x.db.prepare('SELECT status FROM sct_test_refund_commands').get().status,'reconcile_required');
  }finally{x.db.close()}
});
