import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync('modules/supplier-pro-v144.js','utf8');
const nodes={v144Calendar:{innerHTML:''},v144Pricing:{innerHTML:''}};
const listeners={};
const document={
 getElementById:id=>nodes[id]||null,
 addEventListener:(event,callback)=>{listeners[event]=callback;}
};
const bookings=[
 {bookingId:'a',listingId:'item-a',title:'Fixture booking A',startDate:'2026-11-04',endDate:'2026-11-06',status:'confirmed'},
 {bookingId:'b',listingId:'item-b',title:'Fixture booking B',startDate:'2026-11-04',endDate:'2026-11-06',status:'confirmed'}
];
const win={liveSupplierBookings:bookings,v94SupplierListings:[
 {id:'item-a',title:'Item A',priceDay:25},
 {id:'item-b',title:'Item B',priceDay:45}
],addEventListener:()=>{},RentInOrbitI18n:{getLanguage:()=> 'lt'}};
vm.runInNewContext(src,{document,window:win,Date,Intl,Number,String,Array,Object,console});
assert.equal(typeof win.refreshSupplierProV144,'function');
win.refreshSupplierProV144();
assert.ok(nodes.v144Calendar.innerHTML.includes('id="v144CalendarListingFilter"'));
assert.ok(nodes.v144Calendar.innerHTML.includes('Fixture booking A'));
assert.ok(!nodes.v144Calendar.innerHTML.includes('Fixture booking B'),
 'Bookings for a different listing must not leak into the visible calendar');
listeners.change({target:{id:'v144CalendarListingFilter',value:'item-b'}});
assert.ok(nodes.v144Calendar.innerHTML.includes('Fixture booking B'));
assert.ok(!nodes.v144Calendar.innerHTML.includes('Fixture booking A'),
 'Changing listing must isolate calendar events');
assert.ok(nodes.v144Calendar.innerHTML.includes('Skelbimas'),'Listing filter must be labelled');
console.log('PASS isolated calendar with two items and distinct bookings');
