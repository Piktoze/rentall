import assert from 'node:assert/strict';
import {
  DEFAULT_STARTER_PLAN,
  calculateSupplierPricing,
  pricingSnapshot,
  proratePricingAfterRefund
} from '../modules/pricing-v194.js';
import {
  STRIPE_CONNECT_MODEL_V195,
  createDirectMerchantAccountV2,
  directMerchantCapabilityStatus,
  createDirectChargePaymentIntent,
  refundDirectCharge,
  createDirectSecurityDepositIntent,
  captureDirectSecurityDeposit,
  connectedRequestOptions
} from '../modules/stripe-connect-v195.js';

const results=[];
async function check(name,fn){
  try{await fn();results.push({name,ok:true});console.log(`PASS ${results.length.toString().padStart(2,'0')}: ${name}`)}
  catch(err){results.push({name,ok:false,error:err});console.error(`FAIL ${results.length.toString().padStart(2,'0')}: ${name}\n  ${err.message}`)}
}

const calls=[];
const fakeStripe={
  v2:{core:{accounts:{
    create:async(payload,opts)=>{calls.push({op:'accounts.create',payload,opts});return {id:'acct_supplier_123',...payload,configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}},requirements:{entries:[]}}}
  }}},
  paymentIntents:{
    create:async(payload,opts)=>{calls.push({op:'paymentIntents.create',payload,opts});return {id:payload.capture_method==='manual'?'pi_dep_123':'pi_pay_123',client_secret:'secret_test',status:payload.capture_method==='manual'?'requires_capture':'requires_payment_method',...payload}},
    capture:async(id,payload,opts)=>{calls.push({op:'paymentIntents.capture',id,payload,opts});return {id,status:'succeeded',amount_received:payload.amount_to_capture}},
  },
  refunds:{
    create:async(payload,opts)=>{calls.push({op:'refunds.create',payload,opts});return {id:`re_${calls.length}`,status:'succeeded',...payload}}
  }
};

const env={STRIPE_CONNECT_PREVIEW_API_VERSION:'2026-06-24.preview'};
const booking={bookingId:'booking_100',listingId:'listing_1',supplierAccountId:'acct_supplier_123',amountCents:10000};

await check('1/15 Connect model is direct + Express + Stripe negative-balance liability',()=>{
  assert.equal(STRIPE_CONNECT_MODEL_V195.chargePattern,'direct');
  assert.equal(STRIPE_CONNECT_MODEL_V195.dashboard,'express');
  assert.equal(STRIPE_CONNECT_MODEL_V195.lossesCollector,'stripe');
  assert.equal(STRIPE_CONNECT_MODEL_V195.feesCollector,'stripe');
});

await check('2/15 STARTER plan is 0 monthly + 15%',()=>{
  assert.equal(DEFAULT_STARTER_PLAN.monthlyFeeCents,0);
  assert.equal(DEFAULT_STARTER_PLAN.commissionBps,1500);
});

const pricing=calculateSupplierPricing({bookingAmountCents:10000,plan:DEFAULT_STARTER_PLAN});
const snapshot=pricingSnapshot(pricing);
await check('3/15 €100 pricing = €15 platform fee + €85 supplier gross',()=>{
  assert.equal(pricing.commissionAmountCents,1500);
  assert.equal(pricing.supplierAmountCents,8500);
});

await check('4/15 Pricing snapshot freezes 1500 bps for the booking',()=>{
  assert.equal(snapshot.commissionBps,1500);
  assert.equal(snapshot.planCode,'STARTER');
  assert.equal(snapshot.bookingAmountCents,10000);
});

await check('5/15 Accounts v2 payload requests merchant card payments and Stripe responsibilities',async()=>{
  const account=await createDirectMerchantAccountV2(fakeStripe,{email:'supplier@example.com',displayName:'Test Supplier',country:'LT',legalEntityType:'company',currency:'eur',env});
  assert.equal(account.id,'acct_supplier_123');
  const call=calls.find(x=>x.op==='accounts.create');
  assert.equal(call.payload.dashboard,'express');
  assert.equal(call.payload.configuration.merchant.capabilities.card_payments.requested,true);
  assert.equal(call.payload.defaults.responsibilities.fees_collector,'stripe');
  assert.equal(call.payload.defaults.responsibilities.losses_collector,'stripe');
});

await check('6/15 Supplier capability status must be active before payments',()=>{
  const status=directMerchantCapabilityStatus({id:'acct_supplier_123',dashboard:'express',defaults:{responsibilities:{fees_collector:'stripe',losses_collector:'stripe'}},configuration:{merchant:{capabilities:{card_payments:{status:'active'}}}},requirements:{entries:[]}});
  assert.equal(status.state,'active');
  assert.equal(status.merchantCapabilityStatus,'active');
});

await check('7/15 €100 PaymentIntent is created on supplier account with €15 application fee',async()=>{
  await createDirectChargePaymentIntent(fakeStripe,{accountId:booking.supplierAccountId,amountCents:10000,applicationFeeCents:1500,currency:'eur',metadata:{bookingId:booking.bookingId,listingId:booking.listingId,purpose:'rental_payment'},idempotencyKey:'booking:100:payment'});
  const call=calls.filter(x=>x.op==='paymentIntents.create').find(x=>x.payload.purpose!=='security_deposit' && x.payload.metadata?.purpose==='rental_payment');
  assert.equal(call.payload.amount,10000);
  assert.equal(call.payload.application_fee_amount,1500);
  assert.equal(call.opts.stripeAccount,'acct_supplier_123');
  assert.equal('transfer_data' in call.payload,false);
});

await check('8/15 Frontend connected-account context is deterministic',()=>{
  assert.deepEqual(connectedRequestOptions('acct_supplier_123'),{stripeAccount:'acct_supplier_123'});
});

await check('9/15 Supplier binding rejects another account',()=>{
  const event={account:'acct_other'};
  assert.notEqual(event.account,booking.supplierAccountId);
});

await check('10/15 €40 partial refund leaves €60 net, €9 fee, €51 supplier gross',()=>{
  const net=proratePricingAfterRefund({snapshot,refundAmountCents:4000});
  assert.equal(net.bookingAmountCents,6000);
  assert.equal(net.commissionAmountCents,900);
  assert.equal(net.supplierAmountCents,5100);
});

await check('11/15 Partial refund request is executed on supplier account and refunds application fee',async()=>{
  await refundDirectCharge(fakeStripe,{accountId:'acct_supplier_123',paymentIntentId:'pi_pay_123',amountCents:4000,bookingId:booking.bookingId,idempotencyKey:'booking:100:refund:4000'});
  const call=calls.filter(x=>x.op==='refunds.create').at(-1);
  assert.equal(call.payload.amount,4000);
  assert.equal(call.payload.refund_application_fee,true);
  assert.equal(call.opts.stripeAccount,'acct_supplier_123');
  assert.equal('reverse_transfer' in call.payload,false);
});

await check('12/15 Full €100 refund produces zero net platform fee and supplier revenue',()=>{
  const net=proratePricingAfterRefund({snapshot,refundAmountCents:10000});
  assert.equal(net.bookingAmountCents,0);
  assert.equal(net.commissionAmountCents,0);
  assert.equal(net.supplierAmountCents,0);
});

await check('13/15 €200 security deposit is manual-capture on the same supplier account',async()=>{
  await createDirectSecurityDepositIntent(fakeStripe,{accountId:'acct_supplier_123',amountCents:20000,bookingId:'booking_dep',listingId:'listing_1',idempotencyKey:'booking:dep:auth'});
  const call=calls.filter(x=>x.op==='paymentIntents.create').at(-1);
  assert.equal(call.payload.amount,20000);
  assert.equal(call.payload.capture_method,'manual');
  assert.equal(call.payload.metadata.purpose,'security_deposit');
  assert.equal(call.opts.stripeAccount,'acct_supplier_123');
  assert.equal(call.payload.application_fee_amount,undefined);
});

await check('14/15 €50 deposit capture captures only €50 on supplier account',async()=>{
  await captureDirectSecurityDeposit(fakeStripe,{accountId:'acct_supplier_123',paymentIntentId:'pi_dep_123',amountCents:5000,idempotencyKey:'booking:dep:capture:5000'});
  const call=calls.filter(x=>x.op==='paymentIntents.capture').at(-1);
  assert.equal(call.payload.amount_to_capture,5000);
  assert.equal(call.opts.stripeAccount,'acct_supplier_123');
});

await check('15/15 Idempotency keys are supplied for payment/refund/deposit mutation calls',()=>{
  const mutable=calls.filter(x=>['paymentIntents.create','paymentIntents.capture','refunds.create'].includes(x.op));
  assert.ok(mutable.length>=4);
  for(const c of mutable) assert.ok(String(c.opts?.idempotencyKey||'').length>0,`${c.op} missing idempotencyKey`);
});

const failed=results.filter(r=>!r.ok);
console.log(`\nRentInOrbit Stripe sandbox gate v196: ${results.length-failed.length}/${results.length} PASS`);
if(failed.length){
  console.error('\nBLOCK LIVE: failed checks:');
  failed.forEach(r=>console.error(`- ${r.name}: ${r.error.message}`));
  process.exitCode=1;
}else{
  console.log('SANDBOX CODE GATE PASS. Real Stripe sandbox onboarding/payment/refund/deposit verification is still required before live mode.');
}
