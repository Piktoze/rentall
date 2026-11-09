import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createDirectChargePaymentIntent,
  captureDirectChargePaymentIntent,
  cancelDirectChargePaymentIntent
} from './modules/stripe-connect-v195.js';

const calls=[];
const stripe={
  paymentIntents:{
    create:async(body,options)=>{calls.push({op:'create',body,options});return {id:'pi_test_booking',status:'requires_payment_method'};},
    capture:async(id,body,options)=>{calls.push({op:'capture',id,body,options});return {id,status:'succeeded'};},
    cancel:async(id,body,options)=>{calls.push({op:'cancel',id,body,options});return {id,status:'canceled'};}
  }
};
const accountId='acct_TEST_ONLY';
await createDirectChargePaymentIntent(stripe,{
  accountId,amountCents:10000,applicationFeeCents:1500,
  manualCapture:true,idempotencyKey:'booking:example:rental-payment',
  metadata:{bookingId:'example',purpose:'rental_payment',paymentFlow:'preauthorize_then_capture'}
});
assert.equal(calls[0].body.capture_method,'manual');
assert.deepEqual(calls[0].body.payment_method_types,['card']);
assert.equal(calls[0].body.amount,10000);
assert.equal(calls[0].body.application_fee_amount,1500);
assert.equal(calls[0].options.stripeAccount,accountId);
await captureDirectChargePaymentIntent(stripe,{
  accountId,paymentIntentId:'pi_test_booking',idempotencyKey:'booking:example:approval-capture'
});
assert.equal(calls[1].op,'capture');
assert.equal(calls[1].options.idempotencyKey,'booking:example:approval-capture');
assert.equal(calls[1].options.stripeAccount,accountId);
await cancelDirectChargePaymentIntent(stripe,{
  accountId,paymentIntentId:'pi_test_booking',idempotencyKey:'booking:example:cancel-payment'
});
assert.equal(calls[2].op,'cancel');
const server=fs.readFileSync('./server.js','utf8');
const frontend=fs.readFileSync('./app.js','utf8');
assert.match(server,/const rentalPreauthEnabled=false;/,'preauthorization must be disabled in all environments');
assert.match(server,/const preauthorizeRequest=false;/,'pending booking cannot request authorization');
const checkoutRoute=server.slice(server.indexOf("app.post('/api/payments/create-intent'"),server.indexOf("app.post('/api/payments/demo/confirm'"));
const demoRoute=server.slice(server.indexOf("app.post('/api/payments/demo/confirm'"),server.indexOf("app.get('/api/stripe/webhook-events'"));
assert.match(checkoutRoute,/if\(booking\.status!=='confirmed'\)/,'all booking modes require supplier approval before checkout');
assert.match(demoRoute,/if\(booking\.status!=='confirmed'\)/,'all booking modes require supplier approval before demo confirmation');
assert.match(server,/const terminalNonPayable=new Set\(\['pending','expired','cancelled','declined'\]\)/,'legacy Stripe payment for pending booking must refund');
assert.ok(!server.includes("paidListing?.bookingMode==='instant' && paidBooking?.status==='pending'"),'webhook must never auto-confirm instant booking');
assert.match(server,/validateRentalPaymentIntentBinding\(pi,before,connection\.stripeAccountId\)/,'bound authorization');
assert.match(server,/pi\.status==='requires_capture'/,'capture only an authorized payment');
assert.match(server,/CUSTOMER_AUTHORIZATION_REQUIRED/,'block approval before authorization');
assert.match(server,/idempotencyKey:`booking:\$\{before\.bookingId\}:approval-capture`/,'idempotent capture');
assert.match(frontend,/config\.rentalPreauthEnabled/,'front-end feature flags');
assert.match(frontend,/activePaymentPreauthorization/,'authorization checkout copy');
console.log('PASS preauthorization disabled; payment requires supplier approval; legacy helpers isolated');
