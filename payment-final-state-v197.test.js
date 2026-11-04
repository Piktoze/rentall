import assert from 'node:assert/strict';
import fs from 'node:fs';
const server=fs.readFileSync(new URL('./server.js',import.meta.url),'utf8');
const route=server.slice(server.indexOf("app.post('/api/payments/create-intent'"),server.indexOf("app.post('/api/payments/demo/confirm'"));
assert.ok(route.includes("BOOKING_PAYMENT_FINAL"),'payment-final-state rejection missing');
assert.ok(route.indexOf("BOOKING_PAYMENT_FINAL")<route.indexOf("if(demoPaymentsEnabled)"),'must reject before demo processing');
assert.ok(route.indexOf("BOOKING_PAYMENT_FINAL")<route.indexOf("if(booking.stripePaymentIntentId)"),'must reject before Stripe retrieve');
console.log('PASS: paid and refunded bookings cannot request another payment intent');
