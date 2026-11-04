import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveRentalStart,refundFromBooking,MODERATE_POLICY_VERSION} from './modules/cancellation-policy-v197.js';
const start='2026-12-01T12:00:00.000Z';
const booking={startDate:'2026-12-01',rentalStartAt:start,orderValue:100,cancellationPolicyVersion:MODERATE_POLICY_VERSION};
for(const [hours,expected] of [[49,100],[48,100],[47.99,75],[36,75],[24,75],[23.99,50],[12,50],[11.99,0],[0,0],[-12,0]]){
 const now=new Date(new Date(start).getTime()-hours*3600000);
 assert.equal(refundFromBooking(booking,'moderate',now),expected,`moderate at ${hours} h`);
}
assert.equal(refundFromBooking({...booking,orderValue:99.99},'moderate',new Date(Date.parse(start)-36*3600000)),74.99);
assert.equal(refundFromBooking({...booking,cancellationPolicyVersion:'moderate-legacy-v1'},'moderate',new Date(Date.parse(start)-50*3600000)),50,'preserve legacy moderate policy');
assert.equal(refundFromBooking({...booking,cancellationPolicyVersion:'moderate-legacy-v1'},'moderate',new Date(Date.parse(start)-73*3600000)),100);
assert.equal(refundFromBooking({...booking,orderValue:100},'flexible',new Date(Date.parse(start)-12*3600000)),50);
assert.equal(refundFromBooking({...booking,orderValue:100},'strict',new Date(Date.parse(start)-200*3600000)),50);
assert.equal(resolveRentalStart({startDate:'2026-11-26',startTime:'09:00',timeZone:'Europe/Vilnius'}),'2026-11-26T07:00:00.000Z');
assert.equal(resolveRentalStart({startDate:'2026-07-26',startTime:'09:00',timeZone:'Europe/Vilnius'}),'2026-07-26T06:00:00.000Z');
assert.throws(()=>resolveRentalStart({startDate:'2026-03-29',startTime:'03:30',timeZone:'Europe/Vilnius'}),/Ambiguous or nonexistent/);
assert.throws(()=>resolveRentalStart({startDate:'2026-10-25',startTime:'03:30',timeZone:'Europe/Vilnius'}),/Ambiguous or nonexistent/);
assert.throws(()=>resolveRentalStart({startDate:'2026-12-01',startTime:'25:00',timeZone:'Europe/Vilnius'}),/Valid startTime/);
const server=fs.readFileSync('./server.js','utf8');const db=fs.readFileSync('./db.js','utf8');const ui=fs.readFileSync('./index.html','utf8');
assert.match(server,/BOOKING_PAYMENT_FINAL/,'payment re-entry guard');
assert.match(server,/cancelBookingWithPaymentHandling\([\s\S]*?await handleStripeCancellationForBooking/,'cancel validation before Stripe call');
assert.match(server,/forceFullRefund,\s*refundAmountOverride:refundAmount/,'supplier refund decision persisted explicitly');
assert.match(db,/cancellation_policy_snapshot/);
assert.match(ui,/id="rentalStartTime"/);
console.log('PASS cancellation V197: policy boundaries, legacy version, timezone, DST, guard contracts');
