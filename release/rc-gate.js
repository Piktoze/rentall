import fs from 'node:fs';

const server=fs.readFileSync('./server.js','utf8');
const app=fs.readFileSync('./app.js','utf8');
const hub=fs.readFileSync('./modules/customer-booking-hub.js','utf8');
const pkg=JSON.parse(fs.readFileSync('./package.json','utf8'));
const checks=[
  ['version',pkg.version.startsWith('1.0.0-rc.')],
  ['webhook verification',server.includes('stripe.webhooks.constructEvent')],
  ['supplier transfer gate',server.includes('requireSupplierTransferCapability')],
  ['guest token protection',server.includes('verifyBookingPaymentToken')],
  ['readiness',server.includes("app.get('/api/readiness'")],
  ['health probe',server.includes("app.get('/healthz'")],
  ['payment processing warning',(app+hub).includes('Do not pay again while Stripe is processing')],
  ['browser RC spec',fs.existsSync('./e2e/release-candidate.spec.js')],
  ['full 1.0 RC browser suite exists',fs.existsSync('./e2e/rentall-1.0-rc.spec.js')],
  ['supplier workspace module exists',fs.existsSync('./modules/supplier-workspace.js')],
  ['integration readiness module exists',fs.existsSync('./modules/integration-readiness.js')],
  ['validated startup exists',fs.existsSync('./ops/start.js')],
  ['Railway infrastructure exists',fs.existsSync('./.railway/railway.ts')],
  ['persistent upload storage',server.includes('runtimeConfig.uploadsDir')],
  ['public production smoke exists',fs.existsSync('./release/smoke-production.mjs')]
];
for(const [name,passed] of checks)console.log(`${passed?'PASS':'FAIL'} ${name}`);
if(checks.some(([,passed])=>!passed))process.exit(1);
console.log(`PASS release gate ${checks.length}/${checks.length}`);
