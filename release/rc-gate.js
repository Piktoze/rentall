import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

// Guard all source-marked Lithuanian UI labels and booking completion accessibility.
execFileSync(process.execPath,['localization-coverage-v203.test.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['supplier-i18n-v203.test.mjs'],{stdio:'inherit'});

 // Verify backup and isolated restoration scripts have valid syntax before deploying.
for(const script of ['ops/backup-scheduler.js','ops/backup-and-verify.js','ops/test-backup-restore.js','ops/backup-s3.js']){
  execFileSync(process.execPath,['--check',script],{stdio:'inherit'});
}

// Browser suite syntax is checked at build time; execute with npm run test:e2e:privacy
// in an isolated test environment with Playwright Chromium installed.
execFileSync(process.execPath,['--check','e2e/privacy-requests-v261.spec.js'],{stdio:'inherit'});

// Source-only regression suites: safe during build, no Stripe or database mutations.
for(const suite of [
  'live-launch-gate-v243.test.mjs',
  'legal-launch-gate-v246.test.mjs',
  'booking-agreement-v247.test.mjs',
  'supplier-trader-ui-v248.test.mjs',
  'precontract-trader-disclosure-v250.test.mjs',
  'privacy-storage-v251.test.mjs',
  'cookie-storage-v252.test.mjs',
  'privacy-requests-v253.test.mjs',
  'privacy-requests-http-v255.test.mjs',
  'connect-fee-settlement-v244.test.mjs',
  'deposit-payment-timing-v245.test.mjs',
  'backup-evidence-order-v235.test.mjs',
  'expiration.test.js',
  'payment-ops-security.test.js',
  'payment-race.test.js',
  'rental-preauth-v204.test.js',
  'transfer-signature-v206.test.js',
  'transfer-supplier-consent-v207.test.js',
  'return-notes-security-v265.test.mjs',
  'dispute-notification-safety-v266.test.mjs',
  'dispute-atomicity-v267.test.mjs',
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
  'stripe-booking-binding-v234.test.js',
  'stripe-pricing-resume-v236.test.mjs',
  'stripe-delayed-webhook-cancel-v237.test.mjs',
  'stripe-terminal-payment-ui-v238.test.mjs',
  'supplier-order-actions-layout-v239.test.mjs',
  'agreement-localization-state-v240.test.mjs',
  'optional-city-delivery-v241.test.mjs',
  'lithuania-handover-v242.test.mjs',
  'refund-accounting-v107.test.js',
  'booking-idempotency.test.js'
]){
  console.log(`RUN release suite: ${suite}`);
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
  ['reused Stripe payment intent verifies the original application fee',paymentRoute.includes('Number(intent.application_fee_amount)!==platformFee')],
  ['pricing snapshot is not persisted before checking an existing Stripe intent',(()=>{const feeCheck=paymentRoute.indexOf('Number(intent.application_fee_amount)!==platformFee');const conditional=paymentRoute.indexOf('if(booking.stripePaymentIntentId){');const stripeSave=paymentRoute.indexOf('saveBookingPricingSnapshot(db,{bookingId:booking.bookingId,pricing})',conditional);const demoStart=paymentRoute.indexOf('if(demoPaymentsEnabled){');const prematureSave=paymentRoute.slice(0,demoStart).includes('saveBookingPricingSnapshot(');return !prematureSave&&conditional>=0&&feeCheck>conditional&&stripeSave>feeCheck})()],
  ['cancellation refund uses booking idempotency key',server.includes('idempotencyKey:`booking:${booking.bookingId}:cancellation-refund:${cents}`')]
];
const checks=[
  ['version',pkg.version.startsWith('1.0.0-rc.')],
  ['webhook verification',server.includes('stripe.webhooks.constructEvent')],
  ['supplier direct-charge gate',server.includes('requireSupplierDirectChargeCapability')],
  ['guest token protection',server.includes('verifyBookingPaymentToken')],
  ['invited supplier activation requires explicit terms consent',(()=>{const route=server.split("app.post('/api/supplier/activation'")[1]?.split("app.get('/api/supplier/listings/confirm-current'")[0]||'';const html=fs.readFileSync('./index.html','utf8');return route.includes('req.body?.termsAccepted!==true')&&route.includes("code:'TERMS_ACCEPTANCE_REQUIRED'")&&html.includes('id="supplierActivationTerms" required')&&app.includes("termsAccepted:document.getElementById('supplierActivationTerms')?.checked===true")})()],
  ['readiness',server.includes("app.get('/api/readiness'")],
  ['health probe',server.includes("app.get('/healthz'")],
  ['payment processing warning',(app+hub).includes('Do not pay again while Stripe is processing')],
  ['browser RC spec',fs.existsSync('./e2e/release-candidate.spec.js')],
  ['full 1.0 RC browser suite exists',fs.existsSync('./e2e/rentinorbit-1.0-rc.spec.js')],
  ['supplier payments use authoritative Stripe server status',app.includes("refreshLiveStripeStatus();")&&!app.includes('const connected=!!s.stripeConnected')&&!app.includes('accounts[idx].stripeConnected=true')],
  ['legacy Connect migration is clearly shown and cannot trigger new onboarding',app.includes("state==='migration_required'")&&app.includes('connectButton.disabled=legacyMigration')&&app.includes('legacyCopy[locale]')],
  ['Stripe status request not gated by legacy browser account',(()=>{const fn=app.split('async function refreshLiveStripeStatus(){')[1]?.split('\nlet stripeConnectInstance=')[0]||'';return fn.includes("apiJson('/api/stripe/connect/status')")&&!fn.includes('if(!supplierId) return')&&fn.includes('supplierPayoutVerified=false')})()],
  ['Stripe capability sync uses server-side Stripe retrieval, not caller supplied account data',(() => {const route=server.split("app.post('/api/admin/stripe/connect/v2-capability-sync'")[1]?.split("app.post(")[0]||'';return route.includes('await retrieveDirectMerchantAccountV2(stripe,existing.stripeAccountId)')&&route.includes("process.env.RENTINORBIT_STAGING!=='true'")&&!route.includes('const {userId,account}=req.body')} )()],
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
