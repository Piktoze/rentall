import assert from 'node:assert/strict';
import fs from 'node:fs';
import {demoPayoutStatus as status} from './modules/demo-payout-state-v284.js';

const baseline={bookingId:'RB-demo',paymentProvider:'demo',paymentStatus:'paid',
  supplierAmount:85,securityDepositAmount:0,securityDepositStatus:null,
  refundStatus:null,stripeRefundId:null};
assert.equal(status(baseline),'ready');
assert.equal(status(baseline,{completed:true}),'simulated',
  'A demo booking cannot claim a real paid supplier payout');
assert.equal(status(baseline,{hasOpenDispute:true}),'pending');
assert.equal(status({...baseline,paymentStatus:'unpaid'}),'pending');
assert.equal(status({...baseline,paymentStatus:'refunded'}),'pending');
assert.equal(status({...baseline,securityDepositAmount:50,securityDepositStatus:'release_pending'}),'pending');
assert.equal(status({...baseline,securityDepositAmount:50,securityDepositStatus:'claim_pending'}),'pending');
assert.equal(status({...baseline,securityDepositAmount:50,securityDepositStatus:'authorized'}),'pending');
assert.equal(status({...baseline,securityDepositAmount:50,securityDepositStatus:'released'}),'ready');
assert.equal(status({...baseline,securityDepositAmount:50,securityDepositStatus:'captured'}),'ready');
assert.equal(status({...baseline,refundStatus:'pending'}),'pending');
assert.equal(status({...baseline,refundStatus:'failed'}),'pending');
assert.equal(status({...baseline,stripeRefundId:'re_test_demo'}),'pending');
assert.equal(status({...baseline,paymentProvider:'stripe'}),'not_ready');
const src=fs.readFileSync('server.js','utf8');
assert.ok(src.includes('updateDemoPayoutAfterReturn(getRentalBookingById(booking.bookingId),{completed:true})'),
  'Completed demo rentals must be simulation-only');
assert.ok(!src.includes("setBookingPayoutDetails(booking.bookingId,{status:'paid'"),
  'HTTP status endpoint may never invent a real paid payout from demo funds');
assert.ok(src.includes('updateDemoPayoutAfterReturn(getRentalBookingById(bookingId));'),
  'Opening a dispute must recalculate any formerly ready demo payout');
console.log('PASS demo payout ledger: refunds, disputed returns and held deposits do not produce paid supplier claims');
