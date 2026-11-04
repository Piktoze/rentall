import assert from 'node:assert/strict';
import {refundDirectCharge,createDirectChargePaymentIntent} from './modules/stripe-connect-v195.js';
const calls=[];
const stripe={
  refunds:{create:async (body,options)=>{calls.push({type:'refund',body,options});return {id:'re_test_1',status:'succeeded',amount:body.amount};}},
  paymentIntents:{create:async (body,options)=>{calls.push({type:'intent',body,options});return {id:'pi_test_1',status:'requires_payment_method',amount:body.amount};}}
};
for(const [amount,fee] of [[10000,1500],[7500,1125],[5000,750]]){
 await refundDirectCharge(stripe,{accountId:'acct_TEST',paymentIntentId:'pi_test_paid',amountCents:amount,bookingId:'RB-TEST',idempotencyKey:`booking:RB-TEST:cancellation-refund:${amount}`});
 const call=calls.at(-1);
 assert.equal(call.body.amount,amount);
 assert.equal(call.body.refund_application_fee,true);
 assert.equal(call.body.metadata.bookingId,'RB-TEST');
 assert.equal(call.options.stripeAccount,'acct_TEST');
 assert.equal(call.options.idempotencyKey,`booking:RB-TEST:cancellation-refund:${amount}`);
}
await assert.rejects(refundDirectCharge(stripe,{accountId:'acct_TEST',paymentIntentId:'pi_test_paid',amountCents:0,bookingId:'RB-TEST'}),/positive integer/);
await assert.rejects(refundDirectCharge(stripe,{accountId:'acct_TEST',paymentIntentId:'pi_test_paid',amountCents:-100,bookingId:'RB-TEST'}),/positive integer/);
console.log('PASS: V199 Stripe mocked direct refunds: full/partial amount, fee reversal flag, connected account, idempotency, invalid amount');
