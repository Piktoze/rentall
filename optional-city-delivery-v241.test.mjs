import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('./index.html','utf8');
const app=fs.readFileSync('./app.js','utf8');
const server=fs.readFileSync('./server.js','utf8');
assert.match(html,/id="rioCheckoutHandoverMethod"/,'Handover choice should be visible with price before next step');
assert.match(app,/step1Choice\.value='Pickup from owner'/,'Default selection is free pickup');
assert.match(app,/option\.textContent=canDeliver/,'Delivery fee must reflect listing configuration');
assert.match(app,/next\.value=method/,'First-step handover must sync with booking request');
assert.match(app,/choice\.value=isPickup\?'Pickup from owner':'Delivery to my address'/,'Step-two change must sync back');
const begin=server.indexOf('function calculateAuthoritativeBookingTotal('),end=server.indexOf('function validateSupplierListingInput(',begin);
assert.ok(begin>=0&&end>begin,'Authoritative pricing function missing');
const calculate=vm.runInNewContext(server.slice(begin,end)+'\ncalculateAuthoritativeBookingTotal;',{
  calculateAuthoritativeRentalPrice:()=>({rental:100,days:1,quantity:1})
});
const listing={priceDay:100,city:'Vilnius',delivery:'Pickup or delivery',accommodationDelivery:'yes',deliveryZones:['Vilnius'],hotelDeliveryFee:40,deposit:0,minOrder:0};
const base={startDate:'2026-11-23',endDate:'2026-11-24',quantity:1};
assert.equal(calculate(listing,{...base,deliveryCity:'',deliveryAddress:'',accommodationName:''}).total,100);
const priced=calculate(listing,{...base,deliveryCity:'Vilnius',deliveryAddress:'Test street 1',accommodationName:''});
assert.equal(priced.delivery,40);
assert.equal(priced.total,140);
assert.throws(()=>calculate(listing,{...base,deliveryCity:'Kaunas',deliveryAddress:'Test street 1'}),/not available in the selected city/);
assert.throws(()=>calculate(listing,{...base,deliveryCity:'Vilnius',deliveryAddress:''}),/address is required/);
assert.throws(()=>calculate({...listing,delivery:'Pickup only'},{...base,deliveryCity:'Vilnius',deliveryAddress:'Test street 1'}),/not available/);
console.log('PASS free pickup, optional €40 in-city delivery, €140 server total and unsupported-city rejection');
