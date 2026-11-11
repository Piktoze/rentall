import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertExistingRefundCoversCancellation} from './modules/stripe-refund-coverage-v278.js';

assert.equal(assertExistingRefundCoversCancellation({stripeRefundId:null,refundAmount:0},100),true);
assert.equal(assertExistingRefundCoversCancellation({stripeRefundId:'re_full',refundAmount:100},100),true);
assert.equal(assertExistingRefundCoversCancellation({stripeRefundId:'re_partial',refundAmount:20},20),true);
assert.equal(assertExistingRefundCoversCancellation({stripeRefundId:'re_partial',refundAmount:20},19.99),true);
for(const [recorded,required] of [[20,100],[0,100],[19.99,20],[null,100],[-1,100],[NaN,100]]){
  assert.throws(
    ()=>assertExistingRefundCoversCancellation({stripeRefundId:'re_existing',refundAmount:recorded},required),
    e=>e?.code==='REFUND_RECONCILIATION_REQUIRED',
    'An existing refund ID does not prove remaining funds were refunded');
}
const src=fs.readFileSync('server.js','utf8');
const i=src.indexOf('async function handleStripeCancellationForBooking');
const j=src.indexOf('async function cancelBookingWithPaymentHandling',i);
const path=src.slice(i,j);
const succeeded=path.indexOf("if(intent.status==='succeeded')");
const guard=path.indexOf('assertExistingRefundCoversCancellation(booking,refundAmount)',succeeded);
const skipped=path.indexOf('if(!booking.stripeRefundId)',succeeded);
const refund=path.indexOf('await refundDirectCharge(',succeeded);
assert.ok(succeeded>=0&&guard>succeeded&&skipped>guard&&refund>skipped,
  'Refund coverage guard must run before skipping an existing refund ID and before provider mutation');
console.log('PASS partial Stripe refund cannot falsely satisfy larger cancellation refund');
