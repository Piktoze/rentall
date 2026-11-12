import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertProviderRefundCoversCancellation as check} from './modules/stripe-refund-provider-coverage-v281.js';

const base={bookingId:'RB-test-partial',stripePaymentIntentId:'pi_test_partial',
  stripeRefundId:'re_test_first',orderValue:100,refundAmount:20};
const row=(id,amount,status='succeeded')=>({id,amount,status,
  payment_intent:base.stripePaymentIntentId,currency:'eur',
  metadata:{bookingId:base.bookingId}});
const page=(...data)=>({data,has_more:false});
const denied=(booking,amount,result,label)=>assert.throws(
  ()=>check(booking,amount,result),
  err=>err?.code==='REFUND_RECONCILIATION_REQUIRED',label);
assert.equal(check(base,20,page(row('re_test_first',2000))),true);
denied(base,100,page(row('re_test_first',2000)),'Partial 20 cannot cover policy 100');
assert.equal(check({...base,refundAmount:100},100,
  page(row('re_test_first',2000),row('re_test_second',8000))),true);
denied({...base,refundAmount:100},100,
  page(row('re_test_first',2000),row('re_test_second',8000,'pending')),
  'Pending 80 must not be considered refunded');
denied({...base,refundAmount:100},100,
  page(row('re_test_first',2000),row('re_test_second',8000,'failed')),
  'Failed 80 must not be considered refunded');
denied({...base,refundAmount:100},100,
  page(row('re_test_first',2000),row('re_test_second',8000,'canceled')),
  'Canceled 80 must not be considered refunded');
denied({...base,refundAmount:99},100,
  page(row('re_test_first',2000),row('re_test_second',8000,'succeeded')),
  'Wrong local total cannot be accepted');
denied(base,20,page(row('re_not_saved',2000)),'Saved refund ID must be present');
denied(base,20,{data:[row('re_test_first',2000)],has_more:true},
  'Provider pagination must not silently omit refunds');
denied(base,20,{data:[],has_more:false},'Missing provider proof must fail');
denied(base,20,page({...row('re_test_first',2000),payment_intent:'pi_other'}),
  'Wrong Stripe charge cannot be used');
denied(base,20,page({...row('re_test_first',2000),metadata:{bookingId:'RB-other'}}),
  'Another booking cannot provide refund coverage');
denied(base,20,page({...row('re_test_first',2000),currency:'usd'}),
  'Wrong currency rejected');
denied({...base,refundAmount:120},100,
  page(row('re_test_first',12000)),
  'Provider total cannot exceed collected charge');
denied({...base,refundAmount:20},20,
  page(row('re_test_first',2000,'pending')),
  'Saved refund must be settled, not pending');

const server=fs.readFileSync('server.js','utf8');
const i=server.indexOf('async function handleStripeCancellationForBooking');
const j=server.indexOf('async function cancelBookingWithPaymentHandling',i);
const flow=server.slice(i,j);
assert.ok(flow.indexOf('stripe.refunds.list(')>=0 &&
  flow.indexOf('assertProviderRefundCoversCancellation(booking,refundAmount,refunds)')>
  flow.indexOf('stripe.refunds.list(') &&
  flow.indexOf('if(!booking.stripeRefundId){')>
  flow.indexOf('assertProviderRefundCoversCancellation(booking,refundAmount,refunds)'),
  'Connected Stripe refund evidence must be checked before skipping provider mutation');
assert.ok(flow.includes('stripeAccount:connection.stripeAccountId'),
  'Refund list must be read from connected supplier, not platform');
assert.ok(flow.includes('Untracked earlier refund requires manual Stripe reconciliation'),
  'Untracked local refund requires reconciliation instead of under-refunding');
console.log('PASS cumulative Stripe refund coverage: multiple partial refunds, pending/failed, pagination, account binding and untracked local amounts');
