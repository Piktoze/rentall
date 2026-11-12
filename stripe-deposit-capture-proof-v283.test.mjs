import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertConfirmedDepositCapture as check} from './modules/stripe-deposit-capture-proof-v283.js';
const expected={paymentIntentId:'pi_test_deposit_50',bookingId:'RB-test-deposit',amountCents:2500};
const valid={id:expected.paymentIntentId,status:'succeeded',amount_received:2500,
 currency:'eur',metadata:{bookingId:expected.bookingId,purpose:'security_deposit'}};
assert.equal(check(valid,expected),valid);
for(const altered of [
 null,{}, {...valid,id:'pi_other'}, {...valid,status:'requires_capture'},
 {...valid,status:'processing'}, {...valid,amount_received:5000},
 {...valid,amount_received:0}, {...valid,amount_received:2499},
 {...valid,amount_received:undefined}, {...valid,currency:'usd'},
 {...valid,metadata:{...valid.metadata,bookingId:'RB-other'}},
 {...valid,metadata:{...valid.metadata,purpose:'rental_payment'}}
]){
 assert.throws(()=>check(altered,expected),
  e=>e?.code==='DEPOSIT_CAPTURE_RECONCILIATION_REQUIRED',
  'Unverified Stripe deposit capture must fail closed');
}
assert.throws(()=>check(valid,{...expected,amountCents:-100}),
  e=>e?.code==='DEPOSIT_CAPTURE_RECONCILIATION_REQUIRED');
const src=fs.readFileSync('server.js','utf8');
const route=src.slice(src.indexOf("app.post('/api/admin/bookings/:bookingId/deposit/capture'"),
 src.indexOf("app.get('/api/admin/disputes'"));
const validated=route.indexOf('assertConfirmedDepositCapture(captured,{');
const persisted=route.indexOf('setRentalSecurityDepositProviderState(');
assert.ok(validated>=0&&persisted>validated,
 'Stripe amount/currency/booking must be verified before any local captured status');
assert.ok(route.includes('amountCents:captureCents'),
 'Actual requested partial-capture amount must be used as expected amount');
console.log('PASS admin security deposit capture: exact Stripe amount, purpose, currency, booking and ID verified before DB settlement');
