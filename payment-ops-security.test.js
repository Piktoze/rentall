import fs from 'fs';
const server=fs.readFileSync('./server.js','utf8');
function assert(v,m){if(!v)throw new Error(m)}
assert(server.includes("app.get('/api/stripe/webhook-events', requireRole('admin')"),'Stripe webhook logs must be admin-only');
assert(server.includes("app.post('/api/stripe/connect/simulate-event', requireRole('admin')"),'Stripe simulator must be admin-only');
assert(server.includes("NODE_ENV==='production' && process.env.ENABLE_STRIPE_SIMULATOR!=='true'"),'Simulator must default off in production');
assert(server.includes("Cache-Control','no-store, private"),'Sensitive API no-store policy missing');
assert(server.includes("Math.min(200,Number(limit)||50)"),'Webhook log query must be bounded');
// Stripe outage must not turn a charged booking into a cancellation without refund.
// Keep the guard inside the provider-object cancellation branch, after the unpaid/no-provider exit.
assert(/if\(!hasStripePayment && !hasStripeDeposit\) return null;\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*if\(!stripe\) throw new Error\('Stripe is unavailable; payment\/deposit cancellation cannot be verified'\)/.test(server),
  'Stripe cancellation must fail closed when payment or deposit exists and Stripe is unavailable');
// Refunds must be bound to the booking and must not proceed while Stripe is processing.
const cancelHandler=server.split('async function handleStripeCancellationForBooking(booking, refundAmount){')[1]?.split('async function cancelBookingWithPaymentHandling(')[0]||'';
assert(cancelHandler.includes("String(intent.metadata?.bookingId||'')!==String(booking.bookingId)") &&
  cancelHandler.includes("String(intent.metadata?.purpose||'')!=='rental_payment'") &&
  cancelHandler.includes("Number(intent.amount)!==Math.round(Number(booking.orderValue||0)*100)") &&
  cancelHandler.includes("String(intent.currency||'').toLowerCase()!=='eur'"),
  'Cancellation must verify Stripe PaymentIntent booking, purpose, amount, and currency before refund');
assert(cancelHandler.includes("if(intent.status==='processing')") &&
  cancelHandler.includes("error.code='PAYMENT_STILL_PROCESSING'") &&
  cancelHandler.includes("else if(intent.status!=='canceled')"),
  'Processing and unexpected Stripe payment states must stop cancellation');
// Deposit settlement must not be bypassed by cancelling a booking while a hold
// is processing, captured, or tied to another booking.
assert(cancelHandler.includes("String(deposit.metadata?.bookingId||'')!==String(booking.bookingId)") &&
  cancelHandler.includes("String(deposit.metadata?.purpose||'')!=='security_deposit'") &&
  cancelHandler.includes("Number(deposit.amount)!==Math.round(Number(booking.securityDepositAmount||0)*100)") &&
  cancelHandler.includes("String(deposit.currency||'').toLowerCase()!=='eur'"),
  'Cancellation must bind the Stripe security deposit to the booking, amount and currency');
assert(cancelHandler.includes("new Set(['requires_capture','requires_payment_method','requires_confirmation','requires_action']).has(deposit.status)") &&
  cancelHandler.includes("else if(deposit.status!=='canceled')") &&
  cancelHandler.includes("Stripe deposit is not safely cancellable; manual review required"),
  'Only safely cancellable deposit states may finish booking cancellation');
// Do not refund a rental while a captured (not merely held) deposit is unresolved.
const bookingCancel=server.split('async function cancelBookingWithPaymentHandling(bookingId,reason,{forceFullRefund=false}={}){')[1]?.split('function bookingAccessAllowed(')[0]||'';
assert(bookingCancel.includes("String(booking.securityDepositStatus||'').toLowerCase()==='captured'") &&
  bookingCancel.includes("error.code='DEPOSIT_RECONCILIATION_REQUIRED'") &&
  bookingCancel.indexOf("error.code='DEPOSIT_RECONCILIATION_REQUIRED'")<bookingCancel.indexOf('await handleStripeCancellationForBooking(booking,refundAmount)'),
  'Captured deposit must block rental refund before any provider operations');
// Expiry cleanup must not claim a deposit was released while Stripe still holds
// or processes it; the provider object's booking and amount must also match.
const expiryHandler=server.split('async function processExpiredBookings(){')[1]?.split('const BOOKING_EXPIRY_SWEEP_MS=')[0]||'';
assert(expiryHandler.includes("String(dpi.metadata?.bookingId||'')!==String(bookingId)") &&
  expiryHandler.includes("String(dpi.metadata?.purpose||'')!=='security_deposit'") &&
  expiryHandler.includes("Number(dpi.amount)!==Math.round(Number(booking.securityDepositAmount||0)*100)") &&
  expiryHandler.includes("String(dpi.currency||'').toLowerCase()!=='eur'"),
  'Expired booking must verify the Stripe deposit belongs to the booking');
assert(expiryHandler.includes("else if(dpi.status!=='canceled')") &&
  expiryHandler.includes('Expired booking deposit requires provider reconciliation') &&
  expiryHandler.indexOf("else if(dpi.status!=='canceled')")<expiryHandler.indexOf("depositStatus:'released'"),
  'Expiry must fail closed on unsettled deposit rather than marking it released');
// The unresolved provider queue is intentionally admin-only, read-only and
// never exposes customer email or Stripe PaymentIntent IDs.
assert(server.includes("app.get('/api/admin/ops/unreconciled-expired-bookings',requireRole('admin')"),
  'Expired provider reconciliation queue must require admin access');
const queueRoute=server.split("app.get('/api/admin/ops/unreconciled-expired-bookings'")[1]?.split("// V130 non-secret integration capability contract.")[0]||'';
assert(queueRoute.includes("Cache-Control','no-store, private") &&
  !queueRoute.includes('paymentIntentId') &&
  !queueRoute.includes('customerEmail'),
  'Unreconciled bookings route must not leak provider IDs or personal data');
console.log('PASS: V47 payment operations privacy/security checks passed.');
