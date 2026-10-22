import fs from 'fs';
const d=fs.readFileSync('./db.js','utf8'),s=fs.readFileSync('./server.js','utf8'),p=JSON.parse(fs.readFileSync('./package.json','utf8'));
function ok(v,m){if(!v)throw new Error(m)}
ok(p.version.startsWith('1.0.0-rc.')||p.version.startsWith('0.'),'version');
ok(d.includes('export function getFullRentalListing(listingId)'),'full listing getter missing');
ok(d.includes('SELECT data_json FROM rental_listing_details WHERE listing_id=?'),'getter must use full listing data');
ok(s.includes('const inventoryListing=getRentalListing(listingId);'),'inventory source missing');
ok(s.includes('const listingForBooking=getFullRentalListing(listingId);'),'pricing is not sourced from full listing');
ok(s.includes("listingForBooking.moderationStatus==='blocked'"),'blocked listing booking guard missing');
ok(s.includes('calculateAuthoritativeBookingTotal(listingForBooking'),'server price does not use full listing');
console.log('PASS: V65 authoritative pricing source checks passed.');