// Real HTTP multi-account rental handover test. Runs on a disposable local database.
// No Railway volume, remote Stripe, production, email worker or external endpoints.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import Database from 'better-sqlite3';
import {spawn} from 'node:child_process';

const folder=fs.mkdtempSync(path.join(os.tmpdir(),'rentinorbit-api-e2e-'));
const dbPath=path.join(folder,'integration.sqlite');
const env={...process.env,DB_PATH:dbPath,UPLOADS_DIR:path.join(folder,'uploads'),NODE_ENV:'test',RENTINORBIT_STAGING:'true',
  RENTINORBIT_DEMO_PAYMENTS:'true',RENTINORBIT_PREAUTH_ENABLED:'true',EMAIL_WORKER_ENABLED:'false',BACKUP_SCHEDULER_ENABLED:'false',
  RENTALL_SEED_DEMO_USERS:'false',TRUST_PROXY_HOPS:'1'};
for(const k of ['RAILWAY_ENVIRONMENT_ID','RAILWAY_PROJECT_ID','RAILWAY_SERVICE_ID',
  'RAILWAY_VOLUME_MOUNT_PATH','PERSISTENT_DATA_DIR','DATABASE_URL','RENTINORBIT_DB_PATH',
  'STRIPE_SECRET_KEY','STRIPE_PUBLISHABLE_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY',
  'SESSION_SECRET','APP_URL','PUBLIC_BASE_URL','PORT','HOST'])delete env[k];
const previous={...process.env};
for(const k of Object.keys(process.env)){if(!(k in env))delete process.env[k];}
Object.assign(process.env,env);
const {db,createAppUser,upsertRentalListing,createRentalBookingAtomic,
  setBookingPaymentDetails,createRentalAgreement}=await import('./db.js');
const administrator='api-e2e-admin@example.invalid',
  supplier='api-e2e-supplier@example.invalid',renter='api-e2e-renter@example.invalid',
  outsider='api-e2e-outsider@example.invalid',otherSupplier='api-e2e-second-supplier@example.invalid',password='Testing12345!',id='api-e2e-1';
for(const [email,role] of [[administrator,'admin'],[supplier,'supplier'],[otherSupplier,'supplier'],[renter,'customer'],[outsider,'customer']])
  createAppUser({email,password,role,displayName:'E2E Test'});
upsertRentalListing({listingId:'api-e2e-listing',ownerEmail:supplier,title:'Temporary API test item',totalQuantity:1});
createRentalBookingAtomic({bookingId:id,listingId:'api-e2e-listing',startDate:'2099-06-01',
  endDate:'2099-06-02',quantity:1,status:'confirmed',customerEmail:renter,customerName:'API Renter',orderValue:100});
setBookingPaymentDetails({bookingId:id,paymentIntentId:'pi_test_mock_not_stripe',paymentStatus:'paid',
  paymentProvider:'mock',platformFeeAmount:15,supplierAmount:85});
createRentalAgreement({bookingId:id,termsVersion:'e2e-v1',snapshot:{listingTitle:'Temporary API test item',total:100}});
const pendingId='api-e2e-pending';
createRentalBookingAtomic({bookingId:pendingId,listingId:'api-e2e-listing',
  startDate:'2099-07-01',endDate:'2099-07-02',quantity:1,status:'pending',
  customerEmail:renter,customerName:'API Renter',orderValue:100});
createRentalAgreement({bookingId:pendingId,termsVersion:'e2e-full-lifecycle-v1',
  snapshot:{listingTitle:'Temporary API test item',total:100,startDate:'2099-07-01',endDate:'2099-07-02'}});
const payId='api-e2e-payment';
const payFixture=createRentalBookingAtomic({bookingId:payId,listingId:'api-e2e-listing',
  startDate:'2099-06-05',endDate:'2099-06-06',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'API Renter',orderValue:100});
setBookingPaymentDetails({bookingId:payId,paymentIntentId:'demo_pi_prepared_e2e',
  paymentStatus:'requires_payment_method',paymentProvider:'demo',platformFeeAmount:15,supplierAmount:85});
// Dedicated synthetic returned booking for forced notification-storage failure.
// No payment provider or real customer is involved.
const failureBookingId='api-e2e-notification-failure';
createRentalBookingAtomic({bookingId:failureBookingId,listingId:'api-e2e-listing',
  startDate:'2099-09-01',endDate:'2099-09-02',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'Test Renter',orderValue:100});
db.prepare("UPDATE rental_bookings SET status='returned' WHERE booking_id=?").run(failureBookingId);
const concurrentDisputeId='api-e2e-concurrent-dispute';
createRentalBookingAtomic({bookingId:concurrentDisputeId,listingId:'api-e2e-listing',
  startDate:'2099-09-12',endDate:'2099-09-13',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'Test Renter',orderValue:100});
db.prepare("UPDATE rental_bookings SET status='returned' WHERE booking_id=?").run(concurrentDisputeId);


upsertRentalListing({listingId:'api-e2e-instant',ownerEmail:supplier,title:'Instant mode fixture',totalQuantity:1});
db.prepare("UPDATE rental_listings SET booking_mode='instant' WHERE listing_id=?").run('api-e2e-instant');
createRentalBookingAtomic({bookingId:'api-e2e-instant-pending',listingId:'api-e2e-instant',
  startDate:'2099-08-01',endDate:'2099-08-02',quantity:1,status:'pending',
  customerEmail:renter,customerName:'Instant test renter',orderValue:100});

// Unpaid cancellation must release inventory with exactly zero refund.
const unpaidCancelId='api-e2e-unpaid-cancel';
upsertRentalListing({listingId:'api-e2e-unpaid-listing',ownerEmail:supplier,
  title:'Synthetic unpaid cancellation item',totalQuantity:1});
createRentalBookingAtomic({bookingId:unpaidCancelId,listingId:'api-e2e-unpaid-listing',
  startDate:'2099-12-20',endDate:'2099-12-21',quantity:1,status:'pending',
  customerEmail:renter,customerName:'Test Renter',orderValue:100});

// Keep an agreement on an unpaid booking to verify terminal signatures
// are rejected because of booking status, not merely a missing document.
createRentalAgreement({bookingId:unpaidCancelId,termsVersion:'closed-signature-v1',
  snapshot:{listingTitle:'Synthetic unpaid cancellation item',total:100}});

// Concurrent cancellation fixture: two requests racing over one unpaid booking.
const parallelCancelId='api-e2e-parallel-cancel';
createRentalBookingAtomic({bookingId:parallelCancelId,listingId:'api-e2e-unpaid-listing',
  startDate:'2099-12-23',endDate:'2099-12-24',quantity:1,status:'pending',
  customerEmail:renter,customerName:'Test Renter',orderValue:100});

// Cancellation regression: synthetic provider-backed bookings, local test only.
const offlinePaidId='api-e2e-offline-paid';
createRentalBookingAtomic({bookingId:offlinePaidId,listingId:'api-e2e-listing',
  startDate:'2099-11-01',endDate:'2099-11-02',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'Temporary Renter',orderValue:100});
setBookingPaymentDetails({bookingId:offlinePaidId,paymentIntentId:'pi_test_offline_paid',
  paymentStatus:'paid',paymentProvider:'stripe',platformFeeAmount:15,supplierAmount:85});
const offlineDepositId='api-e2e-offline-deposit';
createRentalBookingAtomic({bookingId:offlineDepositId,listingId:'api-e2e-listing',
  startDate:'2099-11-05',endDate:'2099-11-06',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'Temporary Renter',orderValue:100});
db.prepare("UPDATE rental_bookings SET security_deposit_payment_intent_id=?, security_deposit_status=?,security_deposit_amount=? WHERE booking_id=?")
  .run('pi_test_offline_deposit','authorized',50,offlineDepositId);

// A locally paid Stripe booking with no rental PaymentIntent must never
// be reported as refunded without a corresponding provider operation.
const missingIntentId='api-e2e-paid-missing-intent';
createRentalBookingAtomic({bookingId:missingIntentId,listingId:'api-e2e-listing',
  startDate:'2099-12-27',endDate:'2099-12-28',quantity:1,status:'confirmed',
  customerEmail:renter,customerName:'Synthetic Renter',orderValue:100});
setBookingPaymentDetails({bookingId:missingIntentId,paymentIntentId:null,
  paymentStatus:'paid',paymentProvider:'stripe',platformFeeAmount:15,supplierAmount:85});

// Expired provider-backed pending reservation: synthetic identifiers only.
const stalledId='api-e2e-stalled-provider';
upsertRentalListing({listingId:'api-e2e-stalled-listing',ownerEmail:supplier,
  title:'Temporary unreconciled checkout item',totalQuantity:1});
createRentalBookingAtomic({bookingId:stalledId,listingId:'api-e2e-stalled-listing',
  startDate:'2099-12-01',endDate:'2099-12-02',quantity:1,status:'pending',
  customerEmail:renter,customerName:'Temporary E2E Renter',orderValue:100});
db.prepare("UPDATE rental_bookings SET expires_at=?,stripe_payment_intent_id=? WHERE booking_id=?")
  .run('2000-01-01T00:00:00.000Z','pi_test_unreconciled_http',stalledId);

db.close();
Object.keys(process.env).forEach(k=>delete process.env[k]);
Object.assign(process.env,previous);

const socket=net.createServer();
const port=await new Promise((resolve,reject)=>{
 socket.once('error',reject);socket.listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});
});
const base='http://127.0.0.1:'+port;
env.PORT=String(port);env.HOST='127.0.0.1';env.APP_URL=base;env.PUBLIC_BASE_URL=base;
const child=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
let logs='';
child.stdout.on('data',b=>logs+=String(b).slice(-3000));
child.stderr.on('data',b=>logs+=String(b).slice(-3000));

async function api(url,{method='GET',cookie='',data,syntheticClientIp=''}={}){
 const response=await fetch(base+url,{method,headers:{...(cookie?{cookie}:{}),...(data?{'content-type':'application/json'}:{}),...(syntheticClientIp?{'x-forwarded-for':syntheticClientIp}:{})},
   ...(data?{body:JSON.stringify(data)}:{})});
 const body=await response.json().catch(()=>({}));
 return {status:response.status,body,cookie:response.headers.get('set-cookie')?.split(';')[0],cacheControl:response.headers.get('cache-control')};
}
async function signIn(email){
 const r=await api('/api/auth/login',{method:'POST',data:{email,password}});
 assert.equal(r.status,200,'Login: '+email+' '+JSON.stringify(r.body));
 assert.ok(r.cookie?.startsWith('rentinorbit_session='),'Session cookie expected');
 return r.cookie;
}
function status(r,s,label){assert.equal(r.status,s,label+' '+JSON.stringify(r.body));}
let outcome=false;
try{
 let ready=false;
 for(let n=0;n<75;n++){
   if(child.exitCode!==null)throw new Error('Server crashed: '+logs.slice(-2500));
   try{const r=await fetch(base+'/healthz');if(r.ok){ready=true;break}}catch{}
   await new Promise(done=>setTimeout(done,100));
 }
 assert.ok(ready,'Temporary server startup failed: '+logs.slice(-2500));
 // Direct API callers must not bypass legally required account consent.
 const registration={email:'consent-http-e2e@example.invalid',password:'Testing12345!',role:'customer'};
 const rejected=await api('/api/auth/register',{method:'POST',data:registration});
 status(rejected,400,'Account registration without explicit terms acceptance denied');
 assert.equal(rejected.body.code,'TERMS_ACCEPTANCE_REQUIRED');
 const registered=await api('/api/auth/register',{method:'POST',data:{...registration,termsAccepted:true}});
 status(registered,200,'Account registration with explicit terms acceptance succeeds');
 assert.equal(registered.body.user.email,registration.email);
 console.log('PASS HTTP registration requires explicit terms consent');
 // A logged-out cookie must be invalidated by the server, not merely removed
 // in the browser. The response must also remain non-cacheable.
 const ephemeralCookie=await signIn(registration.email);
 const beforeLogout=await api('/api/auth/me',{cookie:ephemeralCookie});
 status(beforeLogout,200,'Fresh session before logout');
 assert.equal(beforeLogout.body.user?.email,registration.email);
 assert.equal(beforeLogout.cacheControl,'no-store, private','Auth profile must not be cached');
 status(await api('/api/auth/logout',{method:'POST',cookie:ephemeralCookie}),200,
   'Server must revoke session on logout');
 const afterLogout=await api('/api/auth/me',{cookie:ephemeralCookie});
 status(afterLogout,200,'Authentication check after logout');
 assert.equal(afterLogout.body.user,null,'Old session cookie must not authenticate after logout');
 status(await api('/api/customer/bookings',{cookie:ephemeralCookie}),401,
   'Revoked cookie must not access private bookings');
 console.log('PASS HTTP logout revokes session and prevents private booking reads');

 const renterCookie=await signIn(renter),supplierCookie=await signIn(supplier),
   outsiderCookie=await signIn(outsider),adminCookie=await signIn(administrator);
 // Enforce the €0 refund rule at the actual HTTP boundary for unpaid bookings.
 const unpaidUrl='/api/rentals/bookings/'+unpaidCancelId+'/cancel';
 status(await api(unpaidUrl,{method:'POST',cookie:outsiderCookie,
   data:{reason:'Unauthorized unpaid cancellation'}}),403,
   'Unrelated customer cannot cancel unpaid booking');
 const unpaidCancellation=await api(unpaidUrl,{method:'POST',cookie:supplierCookie,
   data:{reason:'Supplier cancels unpaid synthetic booking'}});
 status(unpaidCancellation,200,'Supplier cancels unpaid booking without Stripe objects');
 assert.equal(unpaidCancellation.body.refundAmount,0,'Unpaid cancellation must refund €0');
 assert.equal(unpaidCancellation.body.booking?.status,'cancelled');
 const unpaidSnapshot=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{
   const row=unpaidSnapshot.prepare(
     'SELECT refund_amount,stripe_refund_id,payment_status,status FROM rental_bookings WHERE booking_id=?'
   ).get(unpaidCancelId);
   assert.equal(row.refund_amount,0,'Unpaid booking refund record must be zero');
   assert.equal(row.stripe_refund_id,null,'Unpaid cancellation cannot create a refund object');
   assert.equal(row.status,'cancelled');
 }finally{unpaidSnapshot.close();}
 status(await api(unpaidUrl,{method:'POST',cookie:supplierCookie,
   data:{reason:'Repeated unpaid cancellation'}}),409,
   'Repeated unpaid cancellation must be blocked');
 console.log('PASS HTTP unpaid €100 booking: authorized cancellation, €0 refund, no Stripe object, replay blocked');
 const cancelledConsent=await api('/api/rentals/bookings/'+unpaidCancelId+'/agreement/accept',{
   method:'POST',cookie:renterCookie,data:{accepted:true}
 });
 status(cancelledConsent,409,'Cancelled booking cannot be signed after cancellation');
 assert.equal(cancelledConsent.body.code,'AGREEMENT_BOOKING_CLOSED');
 const closedConsent=await api('/api/rentals/bookings/'+unpaidCancelId+'/agreement/accept',{
   method:'POST',cookie:supplierCookie,data:{accepted:true}
 });
 status(closedConsent,409,'Supplier cannot sign a cancelled rental agreement');
 const closedDb=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{
   const signed=closedDb.prepare('SELECT customer_accepted_at,supplier_accepted_at FROM rental_agreements WHERE booking_id=?').get(unpaidCancelId);
   assert.equal(signed.customer_accepted_at,null,'Cancelled renter consent must not mutate agreement');
   assert.equal(signed.supplier_accepted_at,null,'Cancelled supplier consent must not mutate agreement');
 }finally{closedDb.close()}
 console.log('PASS cancelled booking blocks both late signatures without changing acceptance evidence');

 // Two simultaneous cancellation requests must not succeed twice.
 const parallelUrl='/api/rentals/bookings/'+parallelCancelId+'/cancel';
 const parallelResults=await Promise.all([0,1].map(i=>api(parallelUrl,{
   method:'POST',cookie:supplierCookie,
   data:{reason:'Parallel cancellation attempt '+i}
 })));
 assert.deepEqual(parallelResults.map(x=>x.status).sort((a,b)=>a-b),[200,409],
   'Concurrent cancellation must allow one transition only');
 assert.equal(parallelResults.find(x=>x.status===200)?.body.refundAmount,0,
   'Concurrent unpaid cancellation must still refund €0');
 const parallelRead=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{
   const row=parallelRead.prepare('SELECT status,refund_amount,stripe_refund_id FROM rental_bookings WHERE booking_id=?').get(parallelCancelId);
   assert.equal(row.status,'cancelled');
   assert.equal(row.refund_amount,0);
   assert.equal(row.stripe_refund_id,null);
 }finally{parallelRead.close()}
 console.log('PASS HTTP parallel unpaid cancellation: one 200, one 409, zero refund');
 const missingIntentCancellation=await api(
   '/api/rentals/bookings/'+missingIntentId+'/cancel',{
     method:'POST',cookie:supplierCookie,syntheticClientIp:'192.0.2.77',data:{reason:'Missing Stripe intent reconciliation probe'}
   });
 status(missingIntentCancellation,400,'Paid Stripe booking without PaymentIntent cannot be auto-refunded');
 assert.equal(missingIntentCancellation.body.code,'PAYMENT_INTENT_MISSING');
 const missingIntentSnapshot=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{
   const row=missingIntentSnapshot.prepare(
     'SELECT status,payment_status,refund_amount,stripe_refund_id FROM rental_bookings WHERE booking_id=?'
   ).get(missingIntentId);
   assert.equal(row.status,'confirmed','Inconsistent paid booking remains open for reconciliation');
   assert.equal(row.payment_status,'paid');
   assert.equal(row.refund_amount,null,'No fake refund amount is recorded');
   assert.equal(row.stripe_refund_id,null,'No fake provider refund is recorded');
 }finally{missingIntentSnapshot.close()}
 console.log('PASS HTTP paid Stripe booking missing PaymentIntent: refund fail-closed, DB unchanged');
 // Stripe outage must not permit cancellation of a charged rental or
 // an authorized security deposit. Check persisted state, not only HTTP error.
 for(const bookingId of [offlinePaidId,offlineDepositId]){
   const rejected=await api('/api/rentals/bookings/'+bookingId+'/cancel',{
     method:'POST',cookie:supplierCookie,data:{reason:'Provider unavailable test'}
   });
   status(rejected,400,'Stripe-unavailable provider cancellation must fail closed');
   const snapshot=new Database(dbPath,{readonly:true,fileMustExist:true});
   try{
     const state=snapshot.prepare("SELECT status,payment_status,security_deposit_status FROM rental_bookings WHERE booking_id=?").get(bookingId);
     assert.equal(state.status,'confirmed','Provider outage must not cancel the booking');
     if(bookingId===offlinePaidId) assert.equal(state.payment_status,'paid',
       'Provider outage must preserve paid status');
     else assert.equal(state.security_deposit_status,'authorized',
       'Provider outage must preserve deposit authorization');
   }finally{snapshot.close();}
 }
 console.log('PASS HTTP Stripe-offline provider cancellation preserves paid booking and authorized deposit');
 // B1 admin diagnostic: actual HTTP role isolation, redaction and fail-closed.
 const triageUrl='/api/admin/ops/unreconciled-expired-bookings';
 status(await api(triageUrl),401,'Guest cannot inspect unresolved Stripe reservations');
 status(await api(triageUrl,{cookie:renterCookie}),403,'Renter cannot inspect unresolved Stripe reservations');
 status(await api(triageUrl,{cookie:supplierCookie}),403,'Supplier cannot inspect admin Stripe queue');
 const triage=await api(triageUrl,{cookie:adminCookie});
 status(triage,200,'Administrator can inspect unresolved provider queue');
 const stalled=triage.body.bookings.find(row=>row.bookingId===stalledId);
 assert.ok(stalled,'Unreconciled provider booking must be visible to administrator');
 assert.equal(stalled.hasPaymentIntent,true);
 assert.equal(stalled.hasDepositIntent,false);
 assert.equal(triage.body.action,'manual_stripe_provider_review_required');
 assert.ok(!('customerEmail' in stalled)&&!('stripePaymentIntentId' in stalled)&&
   !('securityDepositPaymentIntentId' in stalled),'Queue must not expose personal data or Stripe IDs');
 const verifyUrl=triageUrl+'/'+encodeURIComponent(stalledId)+'/verify';
 status(await api(verifyUrl),401,'Guest cannot verify Stripe provider status');
 status(await api(verifyUrl,{cookie:renterCookie}),403,'Renter cannot verify Stripe provider status');
 status(await api(verifyUrl,{cookie:supplierCookie}),403,'Supplier cannot verify admin Stripe provider status');
 status(await api(verifyUrl,{cookie:adminCookie}),503,
   'Admin provider verification must fail closed when TEST Stripe is not configured');
 const triageAfter=await api(triageUrl,{cookie:adminCookie});
 status(triageAfter,200,'Read-only verification must not change unresolved queue');
 assert.ok(triageAfter.body.bookings.some(row=>row.bookingId===stalledId),
   'Provider verification without Stripe must never release the hold');
 console.log('PASS HTTP admin-only unresolved Stripe triage: roles, redaction, no provider and no release');
 // B1: staging-only Stripe/booking binding inspection must be strictly supplier-scoped.
 const bindingUrl='/api/stripe/connect/booking-binding/'+encodeURIComponent(id);
 status(await api(bindingUrl),401,'Unauthenticated user cannot inspect Stripe booking binding');
 status(await api(bindingUrl,{cookie:renterCookie}),403,'Renter cannot inspect supplier Stripe booking binding');
 status(await api(bindingUrl,{cookie:outsiderCookie}),403,'Unrelated renter cannot inspect Stripe booking binding');
 const otherSupplierCookie=await signIn(otherSupplier);
 status(await api(bindingUrl,{cookie:otherSupplierCookie}),404,'Different supplier cannot inspect listing owner Stripe binding');
 const ownBinding=await api(bindingUrl,{cookie:supplierCookie});
 status(ownBinding,200,'Listing owner can inspect own Stripe booking binding');
 assert.equal(ownBinding.body.bookingId,id);
 assert.equal(ownBinding.body.supplierOwnsListing,true);
 assert.equal(ownBinding.body.hasOwnerStripeConnection,false,'Synthetic supplier has no Stripe account');
 assert.equal(ownBinding.body.bookingHasPaymentIntent,true,'Synthetic mock payment is recorded');
 assert.ok(!('clientSecret' in ownBinding.body)&&!('stripeAccountId' in ownBinding.body)&&!('supplierEmail' in ownBinding.body),
   'Binding report must not reveal Stripe credentials or full supplier identity');
 console.log('PASS HTTP staging Stripe booking-binding: supplier-only, outsider isolation and redacted read-only diagnostics');
 // Booking lists must be scoped to the account identity (not request parameters).
 // Financial audit is never exposed to renters, suppliers or guests.
 status(await api('/api/stripe/webhook-events',{cookie:renterCookie}),403,
   'Renter cannot read payment/webhook audit');
 status(await api('/api/stripe/webhook-events',{cookie:supplierCookie}),403,
   'Supplier cannot read platform-wide payment/webhook audit');
 status(await api('/api/stripe/webhook-events',{cookie:outsiderCookie}),403,
   'Other account cannot read financial audit');
 // Supplier trader self-declaration must not equal verified legal status.
 const initialTrader=await api('/api/supplier/trader-status',{cookie:supplierCookie});
 status(initialTrader,200,'Supplier can inspect trader declaration');
 assert.equal(initialTrader.body.trader.status,'undeclared');
 assert.equal(initialTrader.body.trader.verified,false);
 status(await api('/api/supplier/trader-status',{method:'POST',cookie:supplierCookie,
   data:{status:'trader',confirmed:false}}),400,'Explicit declaration consent required');
 status(await api('/api/supplier/trader-status',{method:'POST',cookie:renterCookie,
   data:{status:'trader',confirmed:true}}),403,'Renter cannot self-declare as supplier');
 status(await api('/api/supplier/trader-status',{method:'POST',cookie:supplierCookie,
   data:{status:'company',confirmed:true}}),400,'Stripe legal entity type is not trader status');
 const declaredTrader=await api('/api/supplier/trader-status',{method:'POST',cookie:supplierCookie,
   data:{status:'trader',confirmed:true}});
 status(declaredTrader,200,'Supplier can declare commercial status');
 assert.equal(declaredTrader.body.trader.status,'trader');
 assert.equal(declaredTrader.body.trader.verified,false,'Self-declared trader is never verified');
 status(await api('/api/supplier/trader-profile',{cookie:renterCookie}),403,
   'Renter cannot view trader traceability details');
 status(await api('/api/supplier/trader-profile',{method:'POST',cookie:renterCookie,
   data:{legalName:'Other Firm'}}),403,'Renter cannot write supplier identity');
 const initialProfile=await api('/api/supplier/trader-profile',{cookie:supplierCookie});
 status(initialProfile,200,'Supplier can view own traceability draft');
 assert.equal(initialProfile.body.profile,null);
 status(await api('/api/supplier/trader-profile',{method:'POST',cookie:supplierCookie,
   data:{legalName:'Test Supplier',contactAddress:'Test Street 1, Vilnius',
     contactPhone:'+37061234567',contactEmail:'supplier@example.invalid',
     euComplianceCertified:false}}),400,'EU compliance self-certification must be explicit');
 const traderProfile=await api('/api/supplier/trader-profile',{method:'POST',cookie:supplierCookie,
   data:{legalName:'Test Supplier',contactAddress:'Test Street 1, Vilnius',
     contactPhone:'+37061234567',contactEmail:'supplier@example.invalid',
     registerName:'Sample Register',registerNumber:'TEST-999',
     euComplianceCertified:true}});
 status(traderProfile,200,'Supplier can submit complete traceability draft');
 assert.equal(traderProfile.body.profile.verified,false,'Draft cannot imply third-party identity verification');
 const savedProfile=await api('/api/supplier/trader-profile',{cookie:supplierCookie});
 status(savedProfile,200,'Submitted traceability details persist');
 assert.equal(savedProfile.body.profile.legalName,'Test Supplier');
 console.log('PASS HTTP trader traceability: supplier-only access, explicit compliance certification, persistence, unverified draft');
 const customerBookings=await api('/api/customer/bookings',{cookie:renterCookie});
 status(customerBookings,200,'Renter booking list');
 assert.equal(customerBookings.cacheControl,'no-store, private','Renter bookings must never be cached');
 assert.ok(customerBookings.body.bookings.some(b=>b.bookingId===id),'Renter sees own rental');
 const unrelatedBookings=await api('/api/customer/bookings',{cookie:outsiderCookie});
 status(unrelatedBookings,200,'Unrelated account booking list');
 assert.equal(unrelatedBookings.cacheControl,'no-store, private','Outsider booking list must never be cached');
 assert.ok(!unrelatedBookings.body.bookings.some(b=>b.bookingId===id),'Outsider must not see renter booking');
 const supplierBookings=await api('/api/rentals/bookings',{cookie:supplierCookie});
 status(supplierBookings,200,'Supplier booking list');
 assert.equal(supplierBookings.cacheControl,'no-store, private','Supplier booking list must never be cached');
 assert.ok(supplierBookings.body.bookings.some(b=>b.bookingId===id),'Supplier sees booking for owned listing');
 const supplierWithForeignFilter=await api('/api/rentals/bookings?ownerEmail=not-the-supplier@example.invalid',{cookie:supplierCookie});
 status(supplierWithForeignFilter,200,'Supplier cannot override ownership via query');
 assert.ok(supplierWithForeignFilter.body.bookings.some(b=>b.bookingId===id),'Supplier owner filter must use session identity');
 status(await api('/api/rentals/bookings',{cookie:renterCookie}),403,'Renter cannot view supplier booking list');
 status(await api('/api/rentals/bookings',{cookie:outsiderCookie}),403,'Outsider cannot view supplier booking list');
 status(await api('/api/customer/bookings/'+id,{cookie:outsiderCookie}),403,'Outsider cannot access renter booking detail');
 const renterDetail=await api('/api/customer/bookings/'+id,{cookie:renterCookie});
 status(renterDetail,200,'Renter can open own booking detail');
 status(await api('/api/customer/bookings/'+id+'?accessToken='+encodeURIComponent(payFixture.paymentToken),{cookie:outsiderCookie}),403,
   'Signed-in outsider cannot use a guest token to impersonate another renter');
 console.log('PASS HTTP booking list and detail account isolation');
 // New public listing must have two to five real uploaded photo files.
 const listingBase={id:'photo-e2e-listing',title:'Photo integration fixture',
   city:'Vilnius',quantity:1,priceDay:12,bookingMode:'request'};
 const publish=photos=>api('/api/supplier/listings',{method:'POST',cookie:supplierCookie,
   data:{listing:{...listingBase,photos,coverPhoto:photos[0]||''}}});
 status(await publish([]),400,'No-photo listing denied');
 status(await publish(['/uploads/not-present.png']),400,'Single-photo listing denied');
 const tinyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Y4kAAAAASUVORK5CYII=';
 const photos=[];
 for(let i=0;i<2;i++){
   const uploaded=await api('/api/uploads/image',{method:'POST',cookie:supplierCookie,
     data:{dataUrl:tinyPng,fileName:'e2e-photo-'+i+'.png'}});
   status(uploaded,200,'Photo file upload');
   assert.ok(uploaded.body.url?.startsWith('/uploads/'));
   photos.push(uploaded.body.url);
 }
 status(await publish([photos[0]]),400,'One uploaded photo denied');
 status(await publish([...photos,...photos,...photos]),400,'Six uploaded photos denied');
 status(await publish(['/uploads/missing-a.png','/uploads/missing-b.png']),400,'Missing uploaded image denied');
 const published=await publish(photos);
 status(published,200,'Two uploaded photos permit listing publication');
 assert.equal(published.body.listing.photos.length,2);
 const publicTraderListings=await api('/api/listings');
 status(publicTraderListings,200,'Public listings available with trader disclosure');
 const publicListing=publicTraderListings.body.listings.find(item=>item.id===listingBase.id);
 assert.ok(publicListing,'Published supplier listing present publicly');
 assert.equal(publicListing.supplierTraderStatus,'trader');
 assert.equal(publicListing.supplierTraderVerified,false);
 assert.equal(publicListing.supplierPublicIdentity,null,'Unverified submitted trader contact data must stay private');
 const publicSellerDisclosure=await api('/api/listings/'+encodeURIComponent(listingBase.id)+'/trader-disclosure');
 status(publicSellerDisclosure,200,'Renter can query authoritative trader status without login');
 assert.equal(publicSellerDisclosure.body.status,'trader');
 assert.equal(publicSellerDisclosure.body.verified,false);
 assert.equal(publicSellerDisclosure.body.publicIdentity,null,
   'Precontract disclosure must never leak unverified trader contact details');
 status(await api('/api/listings/nonexistent-test-item/trader-disclosure'),404,
   'Unknown listing must not expose supplier information');

 status(await api('/api/admin/trader-reviews',{cookie:supplierCookie}),403,
   'Supplier cannot read admin trader evidence queue');
 status(await api('/api/admin/trader-reviews',{cookie:renterCookie}),403,
   'Customer cannot read admin trader evidence queue');
 const queue=await api('/api/admin/trader-reviews',{cookie:adminCookie});
 status(queue,200,'Admin can inspect submitted trader data');
 const reviewRow=queue.body.profiles.find(p=>p.email===supplier);
 assert.ok(reviewRow,'Supplier submitted profile is in admin review queue');
 const reviewUrl='/api/admin/trader-reviews/'+encodeURIComponent(reviewRow.userId);
 const reviewBase={decision:'approved',submittedAt:reviewRow.submittedAt,
   evidenceReference:'TEST-ONLY-SYNTHETIC-EVIDENCE',reviewNote:'Synthetic external checks for isolated HTTP regression',
   identityChecked:true,contactChecked:true,registryChecked:true,paymentAccountChecked:true};
 status(await api(reviewUrl,{method:'POST',cookie:supplierCookie,data:reviewBase}),403,
   'Supplier cannot self-approve trader identity');
 status(await api(reviewUrl,{method:'POST',cookie:adminCookie,
   data:{...reviewBase,identityChecked:false}}),400,
   'Admin may not approve without all independent evidence attestations');
 const approvedTrader=await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase});
 status(approvedTrader,200,'Admin approval with evidence succeeds');
 assert.equal(approvedTrader.body.review.verified,true);
 const afterReviewListing=await api('/api/listings');
 const reviewedListing=afterReviewListing.body.listings.find(l=>l.id===listingBase.id);
 assert.equal(reviewedListing.supplierTraderVerified,true);
 assert.equal(reviewedListing.supplierPublicIdentity?.legalName,'Test Supplier');
 status(await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase}),409,
   'Duplicate approval denied');
 const rejectedTrader=await api(reviewUrl,{method:'POST',cookie:adminCookie,
   data:{...reviewBase,decision:'rejected',reviewNote:'Synthetic dispute of verification evidence'}});
 status(rejectedTrader,200,'Admin rejection revokes verified trader status');
 assert.equal(rejectedTrader.body.review.verified,false);
 const afterRejection=await api('/api/listings');
 assert.equal(afterRejection.body.listings.find(l=>l.id===listingBase.id).supplierPublicIdentity,null,
   'Revoked trader identity must be removed from public listing');
 const again=await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase});
 status(again,200,'Admin may reapprove after a documented rejection');
 const revisedProfile=await api('/api/supplier/trader-profile',{method:'POST',cookie:supplierCookie,
   data:{legalName:'Revised Supplier',contactAddress:'New Test Street 4, Vilnius',
     contactPhone:'+37061234567',contactEmail:'supplier@example.invalid',
     registerName:'Sample Register',registerNumber:'TEST-999',euComplianceCertified:true}});
 status(revisedProfile,200,'Supplier may edit approved profile');
 assert.equal(revisedProfile.body.profile.verified,false,
   'Editing previously approved trader profile revokes its verification');
 const afterProfileEdit=await api('/api/listings');
 const changedListing=afterProfileEdit.body.listings.find(l=>l.id===listingBase.id);
 assert.equal(changedListing.supplierTraderVerified,false);
 assert.equal(changedListing.supplierPublicIdentity,null,
   'Edited identity data stays hidden pending independent re-review');
 status(await api(reviewUrl,{method:'POST',cookie:adminCookie,data:reviewBase}),409,
   'Old approval evidence cannot be reused after supplier profile update');
 console.log('PASS HTTP admin trader review: role isolation, evidence, approval, replay guard, revocation');

 console.log('PASS HTTP supplier trader declaration: identity, consent and unverified public classification');
 const anotherSupplierCookie=await signIn(otherSupplier);
 const attemptedTakeover=await api('/api/supplier/listings',{method:'POST',cookie:anotherSupplierCookie,
   data:{listing:{...listingBase,title:'Unauthorized takeover',photos,coverPhoto:photos[0]}}});
 status(attemptedTakeover,400,'Other supplier must not overwrite listing ID');
 const ownerStillOwns=await api('/api/supplier/listings',{cookie:supplierCookie});
 status(ownerStillOwns,200,'Original supplier listing list');
 assert.ok(ownerStillOwns.body.listings.some(l=>l.id===listingBase.id&&l.title===listingBase.title),
   'Rejected takeover must preserve original owner and title');
 const otherListings=await api('/api/supplier/listings',{cookie:anotherSupplierCookie});
 status(otherListings,200,'Another supplier listing list');
 assert.ok(!otherListings.body.listings.some(l=>l.id===listingBase.id),'Other supplier must not own another listing');
 status(await api('/api/supplier/listings/'+listingBase.id,{method:'DELETE',cookie:anotherSupplierCookie}),
   404,'Other supplier cannot delete listing');
 status(await api('/api/supplier/listings/'+listingBase.id+'/archive',{method:'POST',cookie:anotherSupplierCookie}),
   404,'Other supplier cannot archive listing');
 const updated=await api('/api/supplier/listings',{method:'POST',cookie:supplierCookie,
   data:{listing:{...listingBase,title:'Owner updated title',photos,coverPhoto:photos[0]}}});
 status(updated,200,'Owner can edit listing with valid photos');
 assert.equal(updated.body.listing.title,'Owner updated title');
 console.log('PASS HTTP listing create/edit, photo count, account ownership, archive/delete access');


 // Instant mode must follow the same supplier-first payment rule for the MVP.
 const instantPending=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:'api-e2e-instant-pending'}});
 status(instantPending,409,'Instant mode cannot create a payment intent before supplier approval');
 assert.equal(instantPending.body.code,'SUPPLIER_CONFIRMATION_REQUIRED');
 const instantDemoPending=await api('/api/payments/demo/confirm',{method:'POST',cookie:renterCookie,
   data:{bookingId:'api-e2e-instant-pending',outcome:'succeeded'}});
 status(instantDemoPending,409,'Instant mode cannot complete demo payment before supplier approval');
 assert.equal(instantDemoPending.body.code,'SUPPLIER_CONFIRMATION_REQUIRED');
 status(await api('/api/rentals/bookings/api-e2e-instant-pending/status',{method:'POST',
   cookie:supplierCookie,data:{status:'confirmed'}}),200,'Supplier can confirm instant-mode request');
 const instantUnlocked=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:'api-e2e-instant-pending'}});
 status(instantUnlocked,200,'Instant mode payment unlocked only after supplier confirmation');
 console.log('PASS supplier approval required before payment in request and instant booking modes');

 // Demo is strictly local: verify authorization and terminal state do not regress.
 // Pending request must never create a TEST or demo payment intent until
 // the supplier has accepted the booking, even if preauth flag is requested.
 const pendingCheckout=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId}});
 status(pendingCheckout,409,'Pending request checkout must be blocked');
 assert.equal(pendingCheckout.body.code,'SUPPLIER_CONFIRMATION_REQUIRED');
 const approved=await api('/api/rentals/bookings/'+pendingId+'/status',{method:'POST',
   cookie:supplierCookie,data:{status:'confirmed'}});
 status(approved,200,'Supplier approval without prior card authorization');
 const beforePaymentTrust=await api('/api/rentals/bookings/'+pendingId+'/trust',{cookie:renterCookie});
 status(beforePaymentTrust,200,'Renter sees agreement after supplier booking approval');
 assert.equal(beforePaymentTrust.body.agreement?.customerAcceptedAt,null,
   'Supplier booking approval must never sign the renter agreement');
 assert.equal(beforePaymentTrust.body.agreement?.supplierAcceptedAt,null,
   'Supplier booking approval must not silently sign the supplier agreement');
 const unlocked=await api('/api/payments/create-intent',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId}});
 status(unlocked,200,'Payment intent only after supplier approval');
 assert.ok(unlocked.body.paymentIntentId?.startsWith('demo_pi_'));
 const pendingPaid=await api('/api/payments/demo/confirm',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId,outcome:'succeeded'}});
 status(pendingPaid,200,'Confirmed rental can complete demo payment');
 assert.equal(pendingPaid.body.booking.paymentStatus,'paid');
 const afterPaymentTrust=await api('/api/rentals/bookings/'+pendingId+'/trust',{cookie:renterCookie});
 status(afterPaymentTrust,200,'Renter agreement remains independently unsigned after payment');
 assert.equal(afterPaymentTrust.body.agreement?.customerAcceptedAt,null,
   'Successful payment must not sign the renter agreement');
 // Follow ONE booking from pending through approval, payment, two signatures,
 // pickup, return and subsequent dispute (all local demo money only).
 const fullRoute='/api/rentals/bookings/'+pendingId;
 const renterConsent=await api(fullRoute+'/agreement/accept',{method:'POST',cookie:renterCookie,
   data:{accepted:true}});
 status(renterConsent,200,'Lifecycle renter independently signs agreement');
 const lifecyclePin=await api(fullRoute+'/transfer-code',{method:'POST',cookie:renterCookie,
   data:{purpose:'pickup'}});
 status(lifecyclePin,200,'Lifecycle renter obtains handover PIN');
 assert.equal(lifecyclePin.body.validUntilUsed,true);
 assert.equal(lifecyclePin.body.expiresAt,null);
 status(await api(fullRoute+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:lifecyclePin.body.code}}),409,
   'Full-cycle handover requires the supplier signature independently');
 status(await api(fullRoute+'/agreement/accept',{method:'POST',cookie:supplierCookie,
   data:{accepted:true}}),200,'Lifecycle supplier signs agreement');
 const handover=await api(fullRoute+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:lifecyclePin.body.code}});
 status(handover,200,'Full-cycle item handover');
 assert.equal(handover.body.booking.status,'active');
 status(await api(fullRoute+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:lifecyclePin.body.code}}),409,'Full-cycle pickup PIN replay denied');
 const fullReturn=await api(fullRoute+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'good'}});
 status(fullReturn,200,'Full-cycle supplier confirms return without PIN');
 status(await api(fullRoute+'/agreement/accept',{method:'POST',cookie:renterCookie,
   data:{accepted:true}}),409,'Returned rental cannot be re-signed after handover');

 assert.equal(fullReturn.body.booking.status,'returned');
 const fullDispute=await api('/api/rentals/disputes',{method:'POST',cookie:renterCookie,
   data:{bookingId:pendingId,reason:'Lifecycle test of return dispute'}});
 status(fullDispute,200,'Full-cycle renter can open dispute after return');
 const disputedCompletion=await api(fullRoute+'/status',{method:'POST',cookie:supplierCookie,
   data:{status:'completed'}});
 status(disputedCompletion,409,'Open dispute blocks rental completion');
 assert.equal(disputedCompletion.body.code,'OPEN_DISPUTE_BLOCKS_COMPLETION');
 const disputedSnapshot=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{
   const booking=disputedSnapshot.prepare('SELECT status FROM rental_bookings WHERE booking_id=?').get(pendingId);
   const dispute=disputedSnapshot.prepare("SELECT status FROM rental_disputes WHERE booking_id=? ORDER BY created_at DESC LIMIT 1").get(pendingId);
   assert.equal(booking.status,'returned','Disputed rental must remain returned');
   assert.equal(dispute.status,'open','Completion denial must not close dispute');
 }finally{disputedSnapshot.close()}
 console.log('PASS HTTP returned rental with open dispute cannot be silently completed');

 status(await api(fullRoute+'/cancel',{method:'POST',cookie:renterCookie,
   data:{reason:'Cannot cancel already returned item'}}),409,
   'Full-cycle returned booking cannot be cancelled for automatic refund');
 console.log('PASS single-booking HTTP lifecycle: pending → approval → demo payment → signatures → PIN → return → dispute');

 // Guest tokens work only without a different authenticated account.
 const impersonated=await api('/api/payments/create-intent',{method:'POST',cookie:outsiderCookie,
   data:{bookingId:payId,paymentToken:payFixture.paymentToken}});
 status(impersonated,403,'Foreign logged-in account cannot use valid guest payment token');
 const validGuest=await api('/api/payments/create-intent',{method:'POST',
   data:{bookingId:payId,paymentToken:payFixture.paymentToken}});
 status(validGuest,200,'Unauthenticated genuine guest can use booking token');
 const payRoute='/api/payments/demo/confirm';
 status(await api(payRoute,{method:'POST',cookie:outsiderCookie,
   data:{bookingId:payId,outcome:'succeeded'}}),403,'Outsider cannot pay somebody else booking');
 status(await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'not_a_real_outcome'}}),400,'Unexpected payment result denied');
 const paid=await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'succeeded'}});
 status(paid,200,'Demo payment first success');
 assert.equal(paid.body.booking.paymentStatus,'paid');
 const twice=await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'succeeded'}});
 status(twice,409,'Repeat payment confirmation blocked');
 assert.equal(twice.body.code,'BOOKING_PAYMENT_FINAL');
 const downgrade=await api(payRoute,{method:'POST',cookie:renterCookie,
   data:{bookingId:payId,outcome:'failed'}});
 status(downgrade,409,'Paid booking cannot be downgraded to failed');
 assert.equal(downgrade.body.code,'BOOKING_PAYMENT_FINAL');
 // A generic supplier status update must never bypass the provider-aware
 // cancellation endpoint, even for an already-paid €100 rental.
 const bypassCancel=await api('/api/rentals/bookings/'+payId+'/status',{
   method:'POST',cookie:supplierCookie,data:{status:'cancelled'}
 });
 status(bypassCancel,409,'Paid €100 booking cannot cancel via generic status route');
 assert.equal(bypassCancel.body.code,'CANCELLATION_FLOW_REQUIRED');
 const bypassRead=new Database(dbPath,{readonly:true,fileMustExist:true});
 try{
   const row=bypassRead.prepare('SELECT status,payment_status,refund_amount,stripe_refund_id FROM rental_bookings WHERE booking_id=?').get(payId);
   assert.equal(row.status,'confirmed','Status bypass must not cancel the booking');
   assert.equal(row.payment_status,'paid','Status bypass must preserve paid state');
   assert.equal(row.refund_amount,null,'Status bypass must not invent a refund');
   assert.equal(row.stripe_refund_id,null,'Status bypass must not invent a refund provider record');
 }finally{bypassRead.close()}
 console.log('PASS paid €100 generic status cancellation bypass blocked; dedicated refund flow remains required');
 // A supplier-initiated cancellation after a completed demo payment must
 // refund the full amount once and reject further cancellation/refund attempts.
 const refunded=await api('/api/rentals/bookings/'+payId+'/cancel',{method:'POST',
   cookie:supplierCookie,data:{reason:'Supplier cannot fulfil rental'}});
 status(refunded,200,'Supplier cancels paid booking');
 assert.equal(refunded.body.refundAmount,100,'Supplier cancellation refunds all €100');
 assert.equal(refunded.body.booking.status,'cancelled');
 const refundReplay=await api('/api/rentals/bookings/'+payId+'/cancel',{method:'POST',
   cookie:supplierCookie,data:{reason:'Duplicate cancellation'}});
 status(refundReplay,409,'Duplicate cancellation cannot issue a second refund');
 const afterRefund=await api('/api/payments/create-intent',{method:'POST',
   cookie:renterCookie,data:{bookingId:payId}});
 status(afterRefund,409,'Refunded booking cannot restart checkout');
 console.log('PASS HTTP demo paid €100 refund and duplicate cancellation protection');

 // A valid guest token must not become an identity override for an unrelated signed-in user.
 status(await api('/api/rentals/disputes',{method:'POST',cookie:outsiderCookie,
   data:{bookingId:payId,reason:'Unauthorized dispute probe',accessToken:payFixture.paymentToken}}),
   403,'Signed-in outsider cannot open a dispute with another renter guest token');
 const route='/api/rentals/bookings/'+id;
 // The agreement and acceptance evidence are private to the two booking parties.
 status(await api(route+'/trust',{cookie:outsiderCookie}),403,'Outsider cannot read agreement acceptance evidence');
 status(await api(route+'/agreement',{cookie:outsiderCookie}),403,'Outsider cannot read rental agreement');
 status(await api(route+'/trust',{cookie:renterCookie}),200,'Renter can view booking trust status');
 status(await api(route+'/agreement',{cookie:supplierCookie}),200,'Supplier can view booking agreement');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:outsiderCookie,
   data:{accepted:true,accessToken:payFixture.paymentToken}}),403,
   'Signed-in outsider cannot sign with another booking guest token');
 status(await api(route+'/transfer-code',{method:'POST',cookie:outsiderCookie,
   data:{purpose:'pickup',accessToken:payFixture.paymentToken}}),403,
   'Signed-in outsider cannot obtain renter PIN with guest token');
 status(await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,data:{purpose:'pickup'}}),
   409,'Unsigned renter must not receive PIN');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:outsiderCookie,data:{accepted:true}}),
   403,'Outsider cannot sign');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:renterCookie,data:{accepted:false}}),
   400,'Explicit consent required');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:renterCookie,data:{accepted:true}}),
   200,'Renter signs independently');
 status(await api(route+'/transfer-code',{method:'POST',cookie:supplierCookie,data:{purpose:'pickup'}}),
   403,'Supplier must never receive renter PIN');
 const code=await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,data:{purpose:'pickup'}});
 status(code,200,'Renter PIN after own consent');
 assert.match(code.body.code,/^\d{6}$/);
 assert.equal(code.body.validUntilUsed,true,'Issued pickup code must remain valid until used');
 assert.equal(code.body.expiresAt,null,'Issued pickup code must not expose a countdown');
 const repeatCode=await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,
   data:{purpose:'pickup'}});
 status(repeatCode,200,'Reopening the renter booking must preserve the PIN');
 assert.equal(repeatCode.body.code,code.body.code,'Unused pickup PIN must remain stable');
 const pinTrust=await api(route+'/trust',{cookie:renterCookie});
 status(pinTrust,200,'Renter can inspect pickup PIN status');
 assert.equal(pinTrust.body.transfer.pickup_customer.validUntilUsed,true);
 assert.equal(pinTrust.body.transfer.pickup_customer.expiresAt,null,'Do not expose year-9999 sentinel');

 status(await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:code.body.code}}),409,'Cannot hand over before supplier signs');
 status(await api(route+'/agreement/accept',{method:'POST',cookie:supplierCookie,data:{accepted:true}}),
   200,'Supplier must sign independently');
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:outsiderCookie,
   data:{purpose:'pickup',code:code.body.code}}),403,'Outsider cannot confirm transfer');
 status(await api(route+'/status',{method:'POST',cookie:supplierCookie,data:{status:'active'}}),
   409,'Legacy activation blocked');
 const pickup=await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:code.body.code}});
 status(pickup,200,'Pickup');
 assert.equal(pickup.body.booking.status,'active');
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'pickup',code:code.body.code}}),409,'Pickup replay blocked');
 status(await api(route+'/return',{method:'POST',cookie:supplierCookie,data:{condition:'good'}}),
   409,'Legacy return blocked');
 status(await api(route+'/transfer-code',{method:'POST',cookie:renterCookie,data:{purpose:'return'}}),
   409,'Renter must not need a return PIN');
 status(await api(route+'/return-confirm',{method:'POST',cookie:outsiderCookie,
   data:{returnCondition:'good'}}),403,'Outsider cannot confirm return');
 status(await api(route+'/return-confirm',{method:'POST',cookie:renterCookie,
   data:{returnCondition:'good'}}),403,'Renter cannot confirm own return');
 status(await api(route+'/transfer-confirm',{method:'POST',cookie:supplierCookie,
   data:{purpose:'return',code:code.body.code,returnCondition:'good'}}),409,'Legacy return PIN route disabled');
 status(await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{}}),400,'Return condition required');
 status(await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'damaged'}}),400,'Damage notes required');
 const returned=await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'good',returnNotes:'No damage'}});
 status(returned,200,'Return verified without second PIN');
 status(await api(route+'/return-confirm',{method:'POST',cookie:supplierCookie,
   data:{returnCondition:'good'}}),409,'Return cannot be repeated');
 assert.equal(returned.body.booking.status,'returned');
 // After handover or return, cancellation/refund must be blocked; disputes remain available.
 status(await api(route+'/cancel',{method:'POST',cookie:supplierCookie,
   data:{reason:'Attempt to cancel after physical return'}}),409,
   'Supplier cannot cancel and refund a returned rental');
 status(await api(route+'/cancel',{method:'POST',cookie:renterCookie,
   data:{reason:'Attempt to cancel after physical return'}}),409,
   'Renter cannot cancel and refund a returned rental');
 const disputeOpened=await api('/api/rentals/disputes',{method:'POST',cookie:renterCookie,
   data:{bookingId:id,openedBy:'supplier',reason:'Returned item condition disagreement',
     details:'Requesting administrator review'}});
 status(disputeOpened,200,'Renter can open dispute after return');
 assert.equal(disputeOpened.body.dispute.openedBy,'customer',
   'Caller cannot spoof dispute initiator using openedBy request field');
 const repeatDispute=await api('/api/rentals/disputes',{method:'POST',cookie:supplierCookie,
   data:{bookingId:id,reason:'Second dispute for same booking'}});
 status(repeatDispute,409,'Only one open dispute per booking');
 assert.equal(repeatDispute.body.code,'DISPUTE_ALREADY_OPEN');
 status(await api('/api/rentals/disputes',{method:'POST',cookie:outsiderCookie,
   data:{bookingId:id,reason:'Unrelated account dispute'}}),403,
   'Outsider cannot open a dispute');
 // Two simultaneous attempts must resolve to exactly one open dispute.
 const parallel=await Promise.all([
   api('/api/rentals/disputes',{method:'POST',cookie:renterCookie,
     data:{bookingId:concurrentDisputeId,reason:'Simultaneous renter dispute'}}),
   api('/api/rentals/disputes',{method:'POST',cookie:supplierCookie,
     data:{bookingId:concurrentDisputeId,reason:'Simultaneous supplier dispute'}})
 ]);
 assert.deepEqual(parallel.map(x=>x.status).sort((a,b)=>a-b),[200,409],
   'Only one of two simultaneous dispute POSTs may succeed');
 assert.equal(parallel.find(x=>x.status===409)?.body.code,'DISPUTE_ALREADY_OPEN');
 console.log('PASS HTTP parallel dispute submissions: one success and one conflict');
 console.log('PASS HTTP disputed return: participant identity, one open dispute, no post-handover refund');
 // A foreign renter cannot attach a conversation to someone else's booking.
 const forgedConversation=await api('/api/conversations',{method:'POST',cookie:outsiderCookie,
   data:{listingId:'api-e2e-listing',bookingId:id}});
 status(forgedConversation,403,'Unrelated account cannot create a booking-bound conversation');
 assert.equal(forgedConversation.body.code,'BOOKING_ACCESS_DENIED');
 // Supplier can discover an existing booking in Messages before a conversation exists.
 const supplierChats=await api('/api/conversations',{cookie:supplierCookie});
 status(supplierChats,200,'Supplier booking chat candidates');
 assert.ok(supplierChats.body.bookingCandidates.some(b=>b.bookingId===id&&b.side==='supplier'),
   'Messages must offer the booking renter as an available recipient');
 const outsiderChats=await api('/api/conversations',{cookie:outsiderCookie});
 status(outsiderChats,200,'Outsider messages list');
 assert.ok(!outsiderChats.body.bookingCandidates.some(b=>b.bookingId===id),
   'Unrelated accounts must never see booking chat candidates');
 const conversation=await api('/api/conversations',{method:'POST',cookie:supplierCookie,
   data:{listingId:'api-e2e-listing',bookingId:id}});
 status(conversation,200,'Supplier starts the renter conversation');
 const conversationId=conversation.body.conversation.conversationId;
 const sent=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{
   method:'POST',cookie:supplierCookie,data:{body:'Sveiki, daiktas jau paruoštas.'}});
 status(sent,200,'Supplier can send a booking message');
 const inbox=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{cookie:renterCookie});
 status(inbox,200,'Renter receives the supplier conversation');
 assert.ok(inbox.body.messages.some(m=>m.body==='Sveiki, daiktas jau paruoštas.'));
 const reply=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{
   method:'POST',cookie:renterCookie,data:{body:'Ačiū, atvyksiu sutartu laiku.'}});
 status(reply,200,'Renter can reply to supplier');
 const supplierInbox=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',
   {cookie:supplierCookie});
 status(supplierInbox,200,'Supplier can read renter reply');
 assert.ok(supplierInbox.body.messages.some(m=>m.body==='Ačiū, atvyksiu sutartu laiku.'));
 status(await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',
   {cookie:outsiderCookie}),403,'Outsider cannot read the conversation');
 status(await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{
   method:'POST',cookie:outsiderCookie,data:{body:'Nepriklausantis asmuo'}}),403,
   'Outsider cannot send conversation messages');
 console.log('PASS HTTP two-way booking messages and outsider read/write isolation');
 // Real HTTP fault injection: make in-app notifications impossible only in this
 // temporary, isolated SQLite database, then verify dispute is still durable.
 // Do this after all ordinary flows because the temporary notification table is dropped.
 const {default:SQLite}=await import('better-sqlite3');
 const faultDb=new SQLite(dbPath);
 try{
   faultDb.exec('DROP TABLE rental_notifications');
 }finally{faultDb.close()}
 // The chat message must still return 200 when the notification table is down;
 // otherwise a customer retries and can accidentally duplicate the message.
 const outageText='Pranešimų tarnyba laikinai neveikia';
 const outageMessage=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',{
   method:'POST',cookie:renterCookie,data:{body:outageText}});
 status(outageMessage,200,'Stored message remains successful despite notification-store outage');
 assert.ok(outageMessage.body.message?.messageId,'Persisted chat message ID must be returned');
 const outageInbox=await api('/api/conversations/'+encodeURIComponent(conversationId)+'/messages',
   {cookie:supplierCookie});
 status(outageInbox,200,'Supplier reads message after notification outage');
 assert.equal(outageInbox.body.messages.filter(m=>m.body===outageText).length,1,
   'Notification outage must persist exactly one chat message');
 assert.ok(logs.includes('message_notification_failure'),'Notification failure must be recorded in redacted diagnostics');
 console.log('PASS HTTP message survives notification outage without false failure or duplicate');
 const failedNoticeDispute=await api('/api/rentals/disputes',{method:'POST',
   cookie:renterCookie,data:{bookingId:failureBookingId,
     reason:'Synthetic return disagreement under notification outage'}});
 status(failedNoticeDispute,200,'Dispute registered despite both notification insert failures');
 assert.ok(failedNoticeDispute.body.dispute?.disputeId,'Persisted dispute ID returned');
 const persistedDb=new SQLite(dbPath,{readonly:true});
 try{
   const stored=persistedDb.prepare('SELECT dispute_id,booking_id FROM rental_disputes WHERE booking_id=?').get(failureBookingId);
   assert.equal(stored?.dispute_id,failedNoticeDispute.body.dispute.disputeId);
 }finally{persistedDb.close()}
 const retryFailedNotice=await api('/api/rentals/disputes',{method:'POST',
   cookie:renterCookie,data:{bookingId:failureBookingId,reason:'Retry after successful response'}});
 status(retryFailedNotice,409,'Repeated request cannot create a second open dispute');
 assert.equal(retryFailedNotice.body.code,'DISPUTE_ALREADY_OPEN');
 assert.ok(logs.includes('rental_dispute_notification_failed'),
   'Missing notification infrastructure must be reported in server diagnostics');
 console.log('PASS HTTP injected notification failure: dispute persists, API returns 200, replay returns 409');
 outcome=true;
 console.log('PASS real HTTP two-account pickup PIN and supplier-only return without PIN: consent, role enforcement and replay protection');
}finally{
 child.kill('SIGTERM');
 await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2500))]);
 if(child.exitCode===null)child.kill('SIGKILL');
 fs.rmSync(folder,{recursive:true,force:true});
}
if(!outcome)process.exitCode=1;
