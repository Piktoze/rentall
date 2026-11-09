import assert from 'node:assert/strict';
import fs from 'node:fs';
// Staging-build source regression only; never calls Stripe or the persistent DB.
const server=fs.readFileSync('./server.js','utf8');
const from=server.indexOf("app.post('/api/payments/deposit-intent'");
const until=server.indexOf("async function processExpiredBookings()",from);
assert.ok(from>=0&&until>from,'Deposit authorization route exists');
const route=server.slice(from,until);
const owner=route.indexOf('if(!accountOwner&&!guestOwner)');
const approval=route.indexOf("if(booking.status!=='confirmed')");
const rentPaid=route.indexOf("if(booking.paymentStatus!=='paid')");
const intent=route.indexOf('createDirectSecurityDepositIntent(stripe,');
assert.ok(owner>=0&&approval>owner&&rentPaid>approval&&intent>rentPaid,
 'Identity, supplier approval and paid-rent guards must run before Stripe authorization');
assert.ok(route.includes("code:'SUPPLIER_CONFIRMATION_REQUIRED'"),
 'Pending booking must be blocked before any card hold');
assert.ok(route.includes("code:'RENTAL_PAYMENT_REQUIRED'"),
 'Unpaid booking must be blocked before any card hold');
const paymentStart=server.indexOf("app.post('/api/payments/create-intent'");
const paymentEnd=server.indexOf("app.post('/api/payments/demo/confirm'",paymentStart);
const rentalRoute=server.slice(paymentStart,paymentEnd);
assert.ok(rentalRoute.includes("if(booking.status!=='confirmed')"),
 'Rental charge must require supplier confirmation');
assert.ok(rentalRoute.includes('manualCapture:false')===false,
 'Do not silently force manual capture');
const captureStart=server.indexOf("app.post('/api/admin/bookings/:bookingId/deposit/capture'");
const captureEnd=server.indexOf("app.get('/api/admin/disputes'",captureStart);
const captureRoute=server.slice(captureStart,captureEnd);
assert.ok(captureRoute.includes("requireRole('admin')"),
 'Only an admin may capture a security deposit');
assert.ok(captureRoute.includes("booking.securityDepositStatus!=='claim_pending'"),
 'Capture must require a reviewed claim state');
assert.ok(captureRoute.includes("intent.status!=='requires_capture'"),
 'Capture must require an actual capturable Stripe authorization');
assert.ok(captureRoute.includes('captureCents>maxAmount'),
 'Capture must be capped at authorized amount');
console.log('PASS payment and deposit timing: no preapproval hold, rental paid first, reviewed deposit capture');
