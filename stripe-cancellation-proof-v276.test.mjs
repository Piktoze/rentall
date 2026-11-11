import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertCancelledPaymentIntent} from './modules/stripe-cancellation-proof-v276.js';

const pi='pi_test_confirmation_only';
assert.deepEqual(assertCancelledPaymentIntent({id:pi,status:'canceled'},pi),{id:pi,status:'canceled'});
for(const deposit of [false,true]){
  const code=deposit?'DEPOSIT_CANCELLATION_UNCONFIRMED':'PAYMENT_CANCELLATION_UNCONFIRMED';
  for(const response of [
    null,undefined,{}, {id:pi,status:'processing'},
    {id:pi,status:'requires_capture'}, {id:pi,status:'succeeded'},
    {id:'pi_other',status:'canceled'}, {id:pi}
  ]){
    assert.throws(()=>assertCancelledPaymentIntent(response,pi,{deposit}),
      error=>error?.code===code,'Unconfirmed or cross-booking Stripe cancellation must fail closed');
  }
}
const source=fs.readFileSync('server.js','utf8');
assert.ok(source.includes('assertCancelledPaymentIntent(cancelledPayment,intent.id)'),
  'Rental payment cancellation must verify the provider result before DB mutation');
assert.ok(source.includes('assertCancelledPaymentIntent(cancelledDeposit,deposit.id,{deposit:true})'),
  'Deposit release must verify the provider result before DB mutation');
const handler=source.slice(source.indexOf('async function handleStripeCancellationForBooking'),source.indexOf('async function cancelBookingWithPaymentHandling'));
assert.ok(handler.indexOf('assertCancelledPaymentIntent(cancelledPayment,intent.id)') <
  handler.indexOf("if(booking?.securityDepositPaymentIntentId &&"),
  'Payment cancellation proof must occur before the real Stripe deposit path');
assert.ok(handler.indexOf('assertCancelledPaymentIntent(cancelledDeposit,deposit.id,{deposit:true})')<handler.indexOf("setRentalSecurityDepositProviderState(booking.bookingId,{paymentIntentId:deposit.id"),
  'Deposit cancellation proof must occur before deposit state changes');
console.log('PASS Stripe cancellation confirmation: correct ID + canceled status for payment and deposit, fail closed on ambiguous responses');
