import fs from 'node:fs';
import assert from 'node:assert/strict';

// Source-only build regression: no requests to live endpoints or databases.
const src=fs.readFileSync('./server.js','utf8');
const status=src.split("app.post('/api/rentals/bookings/:bookingId/status'")[1]
  ?.split("app.post('/api/rentals/bookings/:bookingId/return'")[0]||'';
const returnRoute=src.split("app.post('/api/rentals/bookings/:bookingId/return'")[1]
  ?.split("app.",2)[0]||'';
assert.ok(status,'Rental status endpoint missing');
assert.ok(returnRoute,'Legacy return endpoint missing');
assert.ok(status.includes("if(['active','returned'].includes(requestedStatus))"),
  'Cannot allow active or returned through status endpoint in any environment');
assert.ok(status.includes("if(requestedStatus==='completed' &&"),
  'Cannot skip return verification by setting completed from active');
assert.ok(!status.includes("process.env.RENTINORBIT_STAGING==='true' && ['active','returned']"),
  'Security must not be staging-only');
assert.ok(returnRoute.includes("return res.status(409)")&&returnRoute.includes("TRANSFER_CODE_REQUIRED"),
  'Legacy return endpoint must deny code-less handovers');
assert.ok(!returnRoute.includes("process.env.RENTINORBIT_STAGING"),
  'Legacy return protection must be unconditional');
const transfer=src.split("app.post('/api/rentals/bookings/:bookingId/transfer-confirm'")[1]
  ?.split("app.get('/api/rentals/bookings/:bookingId/agreement'")[0]||'';
assert.ok(transfer.includes("requireRole('supplier')")&&transfer.includes("canSupplierManageBooking"),
  'Code-confirm endpoint must be supplier-authenticated and booking-bound');
console.log('PASS unconditional code-only rental status transitions');
