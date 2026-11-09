import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync('./server.js','utf8');
const direct=fs.readFileSync('./modules/stripe-connect-v195.js','utf8');
// v195 direct-charge architecture: booking-bound and idempotent requests.
assert.match(server,/idempotencyKey:`booking:\$\{booking\.bookingId\}:rental-payment`/,'rental payment intent idempotency');
assert.match(server,/BOOKING_PAYMENT_FINAL/,'reject already paid/refunded checkout');
assert.match(server,/if\(!booking\.stripeRefundId\)/,'persisted refund guard');
assert.match(server,/idempotencyKey:`booking:\$\{booking\.bookingId\}:cancellation-refund:\$\{cents\}`/,'cancellation refund idempotency');
assert.match(server,/idempotencyKey:`booking:\$\{bookingId\}:late-terminal-refund`/,'late terminal refund idempotency');
assert.match(server,/new Set\(\['pending','expired','cancelled','declined'\]\)/,'pending and late terminal payments must be refunded');
assert.match(direct,/connectedRequestOptions\(accountId,\{idempotencyKey\}\)/,'Stripe connected-account binding and idempotency');
console.log('PASS: payment race static gate aligned to V195 Direct Charges');
