import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('./app.js','utf8');
const trust=fs.readFileSync('./modules/marketplace-trust-v172.js','utf8');
const finance=fs.readFileSync('./modules/supplier-finance.js','utf8');
const command=fs.readFileSync('./modules/booking-command-center.js','utf8');
const notifications=fs.readFileSync('./modules/customer-notifications.js','utf8');
const i18n=fs.readFileSync('./modules/i18n-v161.js','utf8');
const a=i18n.indexOf('const dictionaries={"lt":{');
const b=i18n.indexOf('"en":{',a);
assert.ok(a>=0 && b>a,'LT locale must exist');
const lt=i18n.slice(a,b);
const start=app.indexOf('renderBookings=async function(){');
const end=app.indexOf("['bookingFilter','bookingCityFilter','bookingDateFilter']",start);
assert.ok(end>start,'Live supplier bookings must exist');
const supplier=app.slice(start,end);
const mustLocalize=[
  'View','Booking ID','Status','Rental dates','Quantity','Order value',
  'Customer','Handover details','Hotel / apartment','City','Address',
  'Room / apartment','Contact person','Phone','Delivery instructions',
  'No special instructions','No live bookings match the selected filters.',
  'Only valid next statuses are shown. Cancelled/declined/returned/completed bookings release inventory.'
];
for(const key of mustLocalize){
 assert.ok(supplier.includes('uiText('+JSON.stringify(key)+')')||supplier.includes("uiText('"+key+"')"),'Supplier booking literal not localized: '+key);
 assert.ok(lt.includes(JSON.stringify(key)+':'),'LT missing: '+key);
}
assert.match(supplier,/uiText\(b\.status\)/,'Backend status must use display translation, not mutate status');
assert.match(supplier,/modal\.scrollTop=0/,'Long supplier modal must open at the top');
for(const key of ['Renter trust','Renter rating','Rental agreement','Renter accepted','Supplier accepted','Messages','View agreement','Policy & return','Refund amount','Return condition','Return notes','Open dispute']){
 assert.ok(lt.includes(JSON.stringify(key)+':'),'Missing trust/returns locale: '+key);
}
for(const key of ['Gross paid rentals','Platform fees','Estimated supplier earnings','Paid bookings']){
 assert.ok(finance.includes('tr('+JSON.stringify(key)+')'),'Finance not translated: '+key);
}
assert.match(command,/Payment becomes available only after supplier approval/,'Do not prompt payment before supplier approves');
assert.match(notifications,/renterNotificationText\(n\.title\)/,'Dynamic notification titles must be translated');
// Rental commitments arrive as immutable English snapshots; translate for display only.
for(const term of [
 'Use the item only for its intended purpose.',
 'Return the item on time in the condition received, allowing for normal wear.',
 'Damage, loss, cancellation and deposit handling follow the listing and RentInOrbit terms.'
]) assert.ok(lt.includes(JSON.stringify(term)+':'),'Missing agreed rental term translation: '+term);
assert.match(trust,/\(s\.terms\|\|\[\]\)\.map\(x=>`<li>\$\{esc\(tr\(x\)\)\}<\/li>`\)/,'Agreed terms must be translated at render time');
console.log('PASS: supplier and renter localization and safe booking order checked');
