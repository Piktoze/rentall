// Staging regression guard: audit all static UI markers and booking-confirmation accessibility.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('./index.html','utf8');
const dict=fs.readFileSync('./modules/i18n-v161.js','utf8');
const app=fs.readFileSync('./app.js','utf8');
const journey=fs.readFileSync('./modules/post-booking-journey.js','utf8');
const truth=fs.readFileSync('./modules/post-booking-live-status.js','utf8');
const start=dict.indexOf('const dictionaries={"lt":{');
const end=dict.indexOf('"en":{',start);
assert.ok(start>=0 && end>start,'Lithuanian translation dictionary missing');
const lt=dict.slice(start,end);
const marked=[...html.matchAll(/data-i18n-(?:text|placeholder|aria-label|title)="([^"]+)"/g)]
  .map(m=>m[1].replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#39;',"'"));
const missing=[...new Set(marked)].filter(key=>!lt.includes(JSON.stringify(key)+':'));
assert.deepEqual(missing,[],'Untranslated Lithuanian UI markers: '+missing.join(', '));
assert.ok(marked.length>500,'Expected complete cross-page static markup coverage');
assert.match(app,/checkoutDialog\.scrollTop=0/,'Booking confirmation must scroll to start');
const confirmationFn=app.slice(app.indexOf('function renderBookingConfirmation(result)'),app.indexOf('async function createBookingWithSafeRetry'));
assert.doesNotMatch(confirmationFn,/card\.scrollIntoView\(/,'Booking confirmation must not force a hidden-header scroll');
for(const key of ['Booking request received','Pending supplier confirmation','Verified total']){
 assert.ok(app.includes("uiText('"+key+"')"),key+' must use translated UI copy');
}
assert.match(journey,/postBookingTranslate/);
assert.match(truth,/const tr=key=>window\.RentInOrbitI18n/);
const customerFn=app.slice(app.indexOf('async function loadUnifiedCustomerBookings(){'),app.indexOf('window.loadUnifiedCustomerBookings=',app.indexOf('async function loadUnifiedCustomerBookings(){')));
assert.ok(customerFn.length>500,'Customer booking list renderer missing');
for(const text of ['Rental dates','Delivery','Total','Payment','Security deposit','Cancel booking','View agreement','Messages','Revoke guest link']){
  assert.ok(customerFn.includes("uiText('"+text+"')"),"Untranslated customer booking interface: "+text);
}
assert.match(customerFn,/uiText\(b\.status\|\|'pending'\)/,'Booking status must be translated');
assert.match(customerFn,/localizeBookingTimelineMessage\(t\.message\)/,'Booking event messages must be localized');
for(const key of ['Rental dates','New booking request','Reservation created','Leave review','Revoke guest link']){
  assert.ok(lt.includes(JSON.stringify(key)+':'),'Missing Lithuanian booking dictionary phrase: '+key);
}
console.log('PASS Lithuanian static UI markers: '+marked.length+'; booking success and live statuses localized');
