import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  verifySctTestPaymentEvidence,reconcileIsolatedSctTestPayment,
} from './modules/isolated-sct-test-payment-reconciler.js';

const binding={id:'RB-test-reconcile',listingId:'listing-1',amountCents:10000,
  feeCents:1500,destination:'acct_fixture',paymentIntentId:'pi_fixture',livemode:false};
const intent={id:'pi_fixture',livemode:false,status:'succeeded',currency:'eur',
  amount:10000,amount_received:10000,latest_charge:'ch_fixture',
  metadata:{bookingId:binding.id,listingId:binding.listingId,purpose:'rental_payment',
    paymentFlow:'separate_charges_and_transfers',supplierStripeAccountId:binding.destination,
    commissionCents:'1500'}};
const charge={id:'ch_fixture',payment_intent:'pi_fixture',livemode:false,status:'succeeded',
  currency:'eur',amount:10000,amount_captured:10000,amount_refunded:0,
  paid:true,captured:true,refunded:false,disputed:false};
const empty={object:'list',has_more:false,data:[]};
const evidence={intent,charge,refunds:empty,disputes:empty,transfers:empty,platformTransfers:empty};

test('authoritative TEST evidence confirms EUR 100 / 15 / 85 only without refund or dispute',()=>{
  assert.deepEqual(verifySctTestPaymentEvidence(binding,evidence),{
    ok:true,bookingId:binding.id,paymentIntentId:'pi_fixture',chargeId:'ch_fixture',
    amountCents:10000,feeCents:1500,supplierCents:8500});
});
test('live data, altered booking metadata or forged charge is blocked',()=>{
  for(const [b,e] of [
    [{...binding,livemode:true},evidence],
    [binding,{...evidence,intent:{...intent,livemode:true}}],
    [binding,{...evidence,intent:{...intent,latest_charge:'ch_other'}}],
    [binding,{...evidence,intent:{...intent,metadata:{...intent.metadata,commissionCents:'0'}}}],
    [binding,{...evidence,charge:{...charge,amount_captured:9500}}],
    [binding,{...evidence,charge:{...charge,payment_intent:'pi_other'}}],
    [binding,{...evidence,intent:{...intent,transfer_data:{destination:binding.destination}}}],
  ])assert.ok(verifySctTestPaymentEvidence(b,e).blocked);
});
test('refunds, disputes and preexisting transfers hold the payment',()=>{
  for(const patch of [
    {charge:{...charge,refunded:true}},
    {charge:{...charge,disputed:true}},
    {charge:{...charge,amount_refunded:100}},
    {refunds:{...empty,data:[{id:'re_fixture'}]}},
    {disputes:{...empty,data:[{id:'dp_fixture',status:'won'}]}},
    {transfers:{...empty,data:[{id:'tr_fixture'}]}},
  ])assert.ok(verifySctTestPaymentEvidence(binding,{...evidence,...patch}).blocked);
});
test('incomplete or paginated provider data cannot certify safe payment',()=>{
  for(const key of ['refunds','disputes','transfers','platformTransfers']){
    assert.equal(verifySctTestPaymentEvidence(binding,{
      ...evidence,[key]:{...empty,has_more:true}}).blocked,'provider_evidence_incomplete');
    assert.equal(verifySctTestPaymentEvidence(binding,{
      ...evidence,[key]:null}).blocked,'provider_evidence_incomplete');
  }
});
test('injected Stripe TEST client reads platform data and returns verified result',async()=>{
  const calls=[];
  const stripe={
    paymentIntents:{retrieve:async(...args)=>{calls.push(['pi',...args]);return intent}},
    charges:{retrieve:async(...args)=>{calls.push(['charge',...args]);return charge}},
    refunds:{list:async(...args)=>{calls.push(['refunds',...args]);return empty}},
    disputes:{list:async(...args)=>{calls.push(['disputes',...args]);return empty}},
    transfers:{list:async(...args)=>{calls.push(['transfers',...args]);return empty}},
  };
  const result=await reconcileIsolatedSctTestPayment({stripe,stripeMode:'test',binding});
  assert.equal(result.ok,true);
  assert.equal(calls.length,6);
  assert.deepEqual(calls[5],['transfers',{limit:100}]);
  assert.deepEqual(calls[0],['pi','pi_fixture']);
  assert.deepEqual(calls[1],['charge','ch_fixture']);
  for(const call of calls)assert.equal(call.some(arg=>arg?.stripeAccount),false);
});
test('off-group Stripe transfer funded by same charge blocks payment and supplier readiness',()=>{
  const transfers=[
    {id:'tr_wrong_group',source_transaction:'ch_fixture',transfer_group:null},
    {id:'tr_booking_meta',source_transaction:null,transfer_group:null,
      metadata:{bookingId:binding.id}},
    {id:'tr_intent_meta',source_transaction:null,transfer_group:null,
      metadata:{paymentIntentId:intent.id}},
  ];
  for(const transfer of transfers)assert.equal(verifySctTestPaymentEvidence(binding,{
    ...evidence,platformTransfers:{...empty,data:[transfer]},
  }).blocked,'existing_ungrouped_transfer_requires_review');
});
test('unrelated complete platform transfer history passes, partial history fails closed',()=>{
  assert.equal(verifySctTestPaymentEvidence(binding,{
    ...evidence,platformTransfers:{...empty,data:[
      {id:'tr_other',source_transaction:'ch_other',transfer_group:'RB-other',metadata:{}},
    ]},
  }).ok,true);
  assert.equal(verifySctTestPaymentEvidence(binding,{
    ...evidence,platformTransfers:{...empty,has_more:true},
  }).blocked,'provider_evidence_incomplete');
});
test('Stripe timeout and wrong mode cannot mark a booking paid',async()=>{
  const stripe={
    paymentIntents:{retrieve:async()=>{throw Error('network timeout')}},
    charges:{retrieve:async()=>charge},refunds:{list:async()=>empty},
    disputes:{list:async()=>empty},transfers:{list:async()=>empty},
  };
  assert.equal((await reconcileIsolatedSctTestPayment({stripe,stripeMode:'test',binding})).blocked,
    'provider_reconciliation_unavailable');
  assert.equal((await reconcileIsolatedSctTestPayment({stripe,stripeMode:'live',binding})).blocked,
    'test_platform_provider_required');
});
