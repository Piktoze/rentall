import fs from 'node:fs';
import assert from 'node:assert/strict';

// Build-time, source-only consent regression: never touch persistent data.
const server=fs.readFileSync('./server.js','utf8');
const route=server.split("app.post('/api/rentals/bookings/:bookingId/agreement/accept'")[1]
  ?.split("app.post('/api/rentals/bookings/:bookingId/transfer-code'")[0]||'';
assert.ok(route.includes("req.body?.accepted!==true"),'Explicit agreement consent must be required');
assert.ok(route.includes("acceptRentalAgreement(id,supplier?'supplier':'customer')"),'Only the explicit consent endpoint signs');
const occurrences=[...server.matchAll(/acceptRentalAgreement\(/g)];
assert.equal(occurrences.length,1,'No implicit supplier signature in webhook or instant payment flows');
assert.ok(server.includes("if(!agreement?.customerAcceptedAt||!agreement?.supplierAcceptedAt)")===false ||
  fs.readFileSync('./db.js','utf8').includes("if(!agreement?.customerAcceptedAt||!agreement?.supplierAcceptedAt)"));
const db=fs.readFileSync('./db.js','utf8');
assert.ok(db.includes("if(!agreement?.customerAcceptedAt||!agreement?.supplierAcceptedAt)"),'Both signatures required by DB transfer gate');
assert.ok(db.includes("party!=='customer'"),'Supplier transfer codes disallowed');
console.log('PASS explicit supplier agreement consent, renter-only PIN, both signatures');
