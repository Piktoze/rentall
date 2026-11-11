import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertPaymentCancellationConsistency} from './modules/stripe-cancellation-consistency-v277.js';

for(const local of ['paid','partially_refunded','refunded']){
  assert.equal(assertPaymentCancellationConsistency({paymentStatus:local},{status:'succeeded'}),true);
  for(const remote of ['canceled','processing','requires_payment_method','requires_capture','requires_action',null]){
    assert.throws(()=>assertPaymentCancellationConsistency({paymentStatus:local},{status:remote}),
      e=>e?.code==='PAYMENT_STATE_CONFLICT',
      'A paid/refunded booking must not be cancelled as an uncollected Stripe charge');
  }
}
for(const remote of ['canceled','processing','requires_payment_method']){
  assert.throws(()=>assertPaymentCancellationConsistency(
    {paymentStatus:'unpaid',stripeRefundId:'re_existing'},{status:remote}),
    e=>e?.code==='PAYMENT_STATE_CONFLICT',
    'A known refund must not be reconciled as an unpaid charge');
}
for(const local of ['unpaid','requires_payment_method','failed']){
  assert.equal(assertPaymentCancellationConsistency({paymentStatus:local},{status:'canceled'}),true);
}
const src=fs.readFileSync('server.js','utf8');
const start=src.indexOf('async function handleStripeCancellationForBooking');
const finish=src.indexOf('async function cancelBookingWithPaymentHandling',start);
const route=src.slice(start,finish);
const binding=route.indexOf("String(intent.metadata?.bookingId||'')");
const guard=route.indexOf('assertPaymentCancellationConsistency(booking,intent)');
const processing=route.indexOf("if(intent.status==='processing')");
const refund=route.indexOf('await refundDirectCharge(',guard);
const cancellation=route.indexOf('await cancelDirectChargePaymentIntent(',guard);
assert.ok(binding>=0&&guard>binding&&processing>guard&&refund>guard&&cancellation>guard,
  'Check local Stripe consistency after binding validation, before provider changes');
console.log('PASS Stripe cancellation state consistency: paid/refunded local bookings reject non-succeeded provider statuses');
