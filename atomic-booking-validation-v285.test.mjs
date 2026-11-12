import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateAtomicBookingWindow as check} from './modules/atomic-booking-validation-v285.js';
const ok=(startDate,endDate,quantity)=>check({startDate,endDate,quantity});
assert.equal(ok('2099-06-01','2099-06-03',1).days,2);
assert.equal(ok('2099-06-01','2099-06-03',999).quantity,999);
assert.equal(ok('2099-06-01','2099-06-03','2').quantity,2);
for(const qty of [0,-1,0.5,1.1,999.01,1000,'abc',null,undefined,NaN,Infinity]){
  assert.throws(()=>ok('2099-06-01','2099-06-03',qty),
    e=>e.code==='INVALID_BOOKING_QUANTITY','Invalid quantity must never enter booking transaction: '+qty);
}
for(const [startDate,endDate] of [
  ['2099-06-01','2099-06-01'],['2099-06-03','2099-06-01'],
  ['2099-02-29','2099-03-01'],['2099-06-31','2099-07-01'],
  ['2099-6-01','2099-07-01'],['2099-06-01','garbage'],
  ['2099-06-01','2101-06-01'],[null,'2099-06-01']
]){
  assert.throws(()=>ok(startDate,endDate,1),
    e=>e.code==='INVALID_BOOKING_DATES',
    'Invalid booking dates must never enter booking transaction: '+String(startDate));
}
const db=fs.readFileSync('db.js','utf8');
const booking=db.slice(db.indexOf('export function createRentalBookingAtomic('),
  db.indexOf('const ALLOWED_BOOKING_STATUSES'));
assert.ok(booking.includes('validateAtomicBookingWindow({startDate,endDate,quantity})'));
assert.ok(booking.indexOf('validateAtomicBookingWindow({startDate,endDate,quantity})') <
  booking.indexOf('const tx = db.transaction('));
console.log('PASS atomic inventory quantity/date guards: fractional, impossible, reversed and oversized windows rejected before DB write');
