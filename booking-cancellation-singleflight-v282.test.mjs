import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBookingCancellationSingleFlight} from './modules/booking-cancellation-singleflight-v282.js';
const once=createBookingCancellationSingleFlight();
let completeFirst;
const first=once('RB-100',()=>new Promise(resolve=>{completeFirst=resolve;}));
let counter=0;
await assert.rejects(()=>once('RB-100',async()=>{counter++;return 'double-charge';}),
  e=>e?.code==='BOOKING_CANCELLATION_IN_PROGRESS');
assert.equal(counter,0,'Blocked parallel request must not execute Stripe operation');
assert.equal(await once('RB-200',async()=>42),42,'Distinct bookings do not block each other');
completeFirst('first-result');
assert.equal(await first,'first-result');
assert.equal(await once('RB-100',async()=>7),7,'Lock released on success');
await assert.rejects(()=>once('RB-100',async()=>{throw Error('Provider unavailable');}),/Provider unavailable/);
assert.equal(await once('RB-100',async()=>8),8,'Lock released on failure');

const server=fs.readFileSync('server.js','utf8');
const i=server.indexOf('async function cancelBookingWithPaymentHandling');
const j=server.indexOf('function bookingAccessAllowed',i);
const path=server.slice(i,j);
assert.ok(path.includes('cancelBookingSingleFlight(bookingId,async()=>{'),
  'Every cancellation must acquire the booking single-flight lock');
assert.ok(path.indexOf('cancelBookingSingleFlight(bookingId,async()=>{')<
  path.indexOf('await handleStripeCancellationForBooking(booking,refundAmount)'),
  'Guard must be entered before any Stripe refund calls');
assert.ok(server.includes("'BOOKING_CANCELLATION_IN_PROGRESS'].includes(err.code)?409:400"),
  'HTTP cancellation conflict must be reported as 409');
console.log('PASS concurrent cancellation guard: one booking operation at a time, conflict, independent IDs, cleanup on errors');
