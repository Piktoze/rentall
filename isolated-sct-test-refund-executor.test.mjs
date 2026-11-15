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
    ('RB-test-refund-exec','pi_fixture','ch_fixture',10000);`);
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
    assert.deepEqual(await x.execute(),{status:'refunded',refundId:'re_fixture'});
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
