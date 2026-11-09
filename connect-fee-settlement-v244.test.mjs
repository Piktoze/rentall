import assert from 'node:assert/strict';
import {
 calculateSupplierPricing,proratePricingAfterRefund,DEFAULT_STARTER_PLAN
} from './modules/pricing-v194.js';
import {
 createDirectChargePaymentIntent,refundDirectCharge,connectedRequestOptions
} from './modules/stripe-connect-v195.js';
import {directMerchantReady} from './modules/stripe-connect-store-v195.js';

// This test has no Stripe network calls and creates no LIVE/TEST provider objects.
const merchant='acct_synthetic_supplier_test_only';
const calls=[];
const fakeStripe={
 paymentIntents:{create:async(body,options)=>{
  calls.push({kind:'payment',body,options});
  return {id:'pi_mock_connect_v244',status:'requires_payment_method'};
 }},
 refunds:{create:async(body,options)=>{
  calls.push({kind:'refund',body,options});
  return {id:'re_mock_connect_v244',status:'succeeded',amount:body.amount};
 }}
};
const ready={connectApi:'v2_merchant_direct',merchantCapabilityStatus:'active',
 feesCollector:'stripe',lossesCollector:'stripe'};
assert.equal(directMerchantReady(ready),true);
for(const [key,value] of [
 ['connectApi','legacy_read_only'],['merchantCapabilityStatus','inactive'],
 ['feesCollector','application'],['lossesCollector','application']
]){
 assert.equal(directMerchantReady({...ready,[key]:value}),false,
  'Nonready/legacy supplier must be rejected: '+key);
}
const euros100=calculateSupplierPricing({bookingAmountCents:10000});
assert.equal(DEFAULT_STARTER_PLAN.commissionBps,1500);
assert.equal(euros100.commissionAmountCents,1500);
assert.equal(euros100.supplierAmountCents,8500);
assert.equal(euros100.bookingAmountCents,
 euros100.commissionAmountCents+euros100.supplierAmountCents);
const payment=await createDirectChargePaymentIntent(fakeStripe,{
 accountId:merchant,amountCents:euros100.bookingAmountCents,
 applicationFeeCents:euros100.commissionAmountCents,
 idempotencyKey:'booking:mock-v244:rental-payment',
 metadata:{bookingId:'mock-v244',purpose:'rental_payment'}
});
assert.equal(payment.status,'requires_payment_method');
assert.equal(calls[0].options.stripeAccount,merchant);
assert.equal(calls[0].options.idempotencyKey,'booking:mock-v244:rental-payment');
assert.equal(calls[0].body.application_fee_amount,1500);
assert.equal(calls[0].body.amount,10000);
assert.equal(calls[0].body.currency,'eur');
const partial=proratePricingAfterRefund({snapshot:euros100,refundAmountCents:4000});
assert.equal(partial.bookingAmountCents,6000);
assert.equal(partial.commissionAmountCents,900);
assert.equal(partial.supplierAmountCents,5100);
const full=proratePricingAfterRefund({snapshot:euros100,refundAmountCents:10000});
assert.equal(full.bookingAmountCents,0);
assert.equal(full.commissionAmountCents,0);
assert.equal(full.supplierAmountCents,0);
await refundDirectCharge(fakeStripe,{accountId:merchant,
 paymentIntentId:payment.id,amountCents:10000,bookingId:'mock-v244',
 idempotencyKey:'booking:mock-v244:cancellation-refund:10000'});
assert.equal(calls[1].options.stripeAccount,merchant);
assert.equal(calls[1].options.idempotencyKey,'booking:mock-v244:cancellation-refund:10000');
assert.equal(calls[1].body.refund_application_fee,true);
assert.equal(calls[1].body.amount,10000);
assert.equal(calls[1].body.metadata.bookingId,'mock-v244');
await assert.rejects(
 createDirectChargePaymentIntent(fakeStripe,{accountId:merchant,amountCents:10000,applicationFeeCents:10001}),
 /applicationFeeCents/);
await assert.rejects(refundDirectCharge(fakeStripe,{accountId:merchant,
 paymentIntentId:payment.id,amountCents:0}),/positive integer/);
assert.throws(()=>connectedRequestOptions('',{}),/Connected account ID/);
console.log('PASS TEST-only Connect accounting: 100 EUR -> 15 EUR platform / 85 EUR supplier, refunds, binding, idempotency');
