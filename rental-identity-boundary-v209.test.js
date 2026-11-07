import assert from 'node:assert/strict';
import fs from 'node:fs';

// Read-only build regression; no login, database, Stripe, or external API actions.
const server=fs.readFileSync('./server.js','utf8');
const agreement=server.split("app.post('/api/rentals/bookings/:bookingId/agreement/accept'")[1]
  ?.split("app.post('/api/rentals/bookings/:bookingId/transfer-code'")[0]||'';
const code=server.split("app.post('/api/rentals/bookings/:bookingId/transfer-code'")[1]
  ?.split("app.post('/api/rentals/bookings/:bookingId/transfer-confirm'")[0]||'';
assert.ok(agreement&&code,'Rental agreement and PIN routes must exist');
assert.ok(agreement.includes("const guestCustomer=!user&&!!verifyBookingPaymentToken("),
  'A guest token must not allow a signed-in unrelated user to accept on behalf of the renter');
assert.ok(agreement.includes("const customer=!supplier&&(accountCustomer||guestCustomer)"),
  'Agreement role must bind to the actual party');
assert.ok(agreement.includes("authMethod:user?'session':'booking_guest_token'"),
  'Acceptance method must match real authentication source');
assert.ok(agreement.includes("req.body?.accepted!==true"),
  'Signing requires explicit consent');
assert.ok(code.includes("const isGuestCustomer=!user&&!!verifyBookingPaymentToken("),
  'PIN issuance with a guest token must require an unauthenticated guest session');
assert.ok(code.includes("if(isSupplier||(!isAccountCustomer&&!isGuestCustomer))"),
  'Supplier and unrelated account must be denied renter PIN access');
assert.ok(code.includes("issueRentalTransferCode(id,req.body?.purpose,'customer')"),
  'Only renter PIN can be issued');
assert.ok(!code.includes("const role=isSupplier?'supplier'"),
  'Supplier PIN issuance must not reappear');
console.log('PASS identity-bound agreement and renter-only PIN routes');
