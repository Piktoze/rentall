import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// Guard all source-marked Lithuanian UI labels and booking completion accessibility.
execFileSync(process.execPath,['localization-coverage-v203.test.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['supplier-i18n-v203.test.mjs'],{stdio:'inherit'});

 // Verify backup and isolated restoration scripts have valid syntax before deploying.
for(const script of ['ops/backup-scheduler.js','ops/backup-and-verify.js','ops/test-backup-restore.js','ops/backup-s3.js']){
  execFileSync(process.execPath,['--check',script],{stdio:'inherit'});
}

// Source-only regression suites: safe during build, no Stripe or database mutations.
for(const suite of [
  'payment-race.test.js',
  'rental-preauth-v204.test.js',
  'transfer-signature-v206.test.js',
  'transfer-supplier-consent-v207.test.js',
  'rental-status-bypass-v208.test.js',
  'rental-identity-boundary-v209.test.js',
  'rental-http-e2e-v210.test.js',
  'minimal-supplier-offer-v211.test.js',
  'ux-focus-v212.test.js',
  'supplier-calendar-isolation-v213.test.js',
  'supplier-ux-navigation-v214.test.js',
  'localization-and-photos-v215.test.js',
  'localization-complete-v216.test.js',
  'listing-photo-submit-v217.test.js',
  'supplier-hub-removal-v218.test.js',
  'webhook-ordering.test.js',
  'webhook-signed-http-v231.test.js',
  'customer-pay-resume-v232.test.js',
  'refund-accounting-v107.test.js',
  'booking-idempotency.test.js'
]){
  execFileSync(process.execPath,[suite],{stdio:'inherit'});
}

const server=fs.readFileSync('./server.js','utf8');
const app=fs.readFileSync('./app.js','utf8');
const hub=fs.readFileSync('./modules/customer-booking-hub.js','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
// Static payment safety checks supplement, but do not replace, Stripe TEST E2E.
const paymentRoute=server.split("app.post('/api/payments/create-intent'")[1]?.split("app.post(")[0]||'';
const paymentSafetyChecks=[
  ['payment access bound to customer or guest token',paymentRoute.includes('verifyBookingPaymentToken(bookingId,paymentToken)')&&paymentRoute.includes('if(!accountOwner&&!guestOwner)')],
  ['supplier approval required for request bookings',paymentRoute.includes("booking.status!=='confirmed'")&&paymentRoute.includes("code:'SUPPLIER_CONFIRMATION_REQUIRED'")],
  ['paid/refunded booking cannot restart checkout',paymentRoute.includes("code:'BOOKING_PAYMENT_FINAL'")&&paymentRoute.includes("'partially_refunded'")],
  ['Stripe payment intent uses booking idempotency key',paymentRoute.includes('idempotencyKey:`booking:${booking.bookingId}:rental-payment`')],
  ['cancellation refund uses booking idempotency key',server.includes('idempotencyKey:`booking:${booking.bookingId}:cancellation-refund:${cents}`')]
];
const checks=[
  ['version',pkg.version.startsWith('1.0.0-rc.')],
  ['webhook verification',server.includes('stripe.webhooks.constructEvent')],
  ['supplier direct-charge gate',server.includes('requireSupplierDirectChargeCapability')],
  ['guest token protection',server.includes('verifyBookingPaymentToken')],
  ['readiness',server.includes("app.get('/api/readiness'")],
  ['health probe',server.includes("app.get('/healthz'")],
  ['payment processing warning',(app+hub).includes('Do not pay again while Stripe is processing')],
  ['browser RC spec',fs.existsSync('./e2e/release-candidate.spec.js')],
  ['full 1.0 RC browser suite exists',fs.existsSync('./e2e/rentinorbit-1.0-rc.spec.js')],
  ['supplier payments use authoritative Stripe server status',app.includes("refreshLiveStripeStatus();")&&!app.includes('const connected=!!s.stripeConnected')&&!app.includes('accounts[idx].stripeConnected=true')],
  ['supplier workspace module exists',fs.existsSync('./modules/supplier-workspace.js')],
  ['integration readiness module exists',fs.existsSync('./modules/integration-readiness.js')],
  ['validated startup exists',fs.existsSync('./ops/start.js')],
  ['Railway infrastructure exists',fs.existsSync('./.railway/railway.ts')],
  ['persistent upload storage',server.includes('runtimeConfig.uploadsDir')],
  ['public production smoke exists',fs.existsSync('./release/smoke-production.mjs')],
  ...paymentSafetyChecks
];
for(const [name,passed] of checks)console.log(`${passed?'PASS':'FAIL'} ${name}`);
if(checks.some(([,passed])=>!passed))process.exit(1);
console.log(`PASS release gate ${checks.length}/${checks.length}`);
