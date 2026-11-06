import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {supplierResponseSchedule, supplierTimezoneForListing} from './modules/supplier-response-clock-v187.js';

const listing={country:'LT',supplierTimezone:'UTC',supplierResponseHours:4,bookingMode:'request'};
assert.equal(supplierTimezoneForListing(listing),'Europe/Vilnius');
assert.equal(supplierTimezoneForListing({...listing,supplierTimezone:'Etc/UTC'}),'Europe/Vilnius');
assert.equal(supplierTimezoneForListing({...listing,supplierTimezone:'Europe/Madrid'}),'Europe/Madrid');
assert.equal(supplierTimezoneForListing({...listing,supplierTimezone:''}),'Europe/Vilnius');
assert.equal(supplierResponseSchedule('2026-11-06T17:20:00.000Z',4,supplierTimezoneForListing(listing)).dueAt,'2026-11-07T07:20:00.000Z');

const document={readyState:'loading',documentElement:{lang:'lt'},addEventListener(){},getElementById(){return null;}};
const window={};
vm.runInNewContext(fs.readFileSync('./modules/renter-response-deadline-v189.js','utf8'),{window,document,Date,Intl,Math,Number,String,encodeURIComponent,setTimeout}, {filename:'renter-response-deadline-v189.js'});
const due=window.rentinorbitSupplierDeadline.estimate(listing,new Date('2026-11-06T17:20:00.000Z'));
assert.equal(due,'2026-11-07T07:20:00.000Z');
console.log('PASS: 4 active hours in Vilnius from Nov 6 19:20 reach Nov 7 09:20, client and server match');
